import collect from 'collect.js'
import keymap from 'native-keymap'
import Emitter from '@/services/Emitter'
import { findDuplicatesInArray, isSameArray, getArrayDepth } from '@/helpers'

// eslint-disable-next-line
console.table(keymap.getKeyMap())

export default class Keyboard {

  static specialKeyNames = [
    'Shift',
    'Control',
    'Alt',
    'Meta',
  ]

  static blockedKeys = [
    'NumpadDivide',
    'NumpadMultiply',
    'NumpadSubtract',
    'NumpadAdd',
    'NumpadDecimal',
    'NumpadEqual',
  ]

  static blockedShortcuts = [
    ['Meta', 'Tab'], // switch app
    ['Meta', 'Shift', '4'], // screenshot
    ['Meta', 'Shift', '5'], // screenshot
    ['Meta', 'Shift', '6'], // screenshot
    ['Alt', 'Meta', 'Escape'], // force quit
    ['F11'], // show desktop
    ['Meta', 'Space'], // spotlight
  ]

  static keymap = Object
    .entries(keymap.getKeyMap())
    .map(([code, data]) => ({
      code,
      ...data,
    }))
    // maybe this will break something
    .filter(key => !this.blockedKeys.includes(key.code))

  static formats = {
    CapsLock: '⇪',
    Shift: '⇧',
    Control: '⌃',
    Alt: '⌥',
    Meta: '⌘',
    ArrowUp: '↑',
    ArrowRight: '→',
    ArrowDown: '↓',
    ArrowLeft: '←',
    Enter: '↩',
    Backspace: '⌫',
    Delete: '⌦',
    Escape: '⎋',
    Tab: '⇥',
    PageUp: '⇞',
    PageDown: '⇟',
    Space: '␣',
  }

  static formatKeyCode(name) {
    return this.formats[name] ? this.formats[name] : name
  }

  constructor() {
    this.emitter = new Emitter()
    this.specialKeys = []
    this.regularKeys = []
    this.keydownHandler = this.handleKeydown.bind(this)
    this.keyupHandler = this.handleKeyup.bind(this)
    window.addEventListener('keydown', this.keydownHandler)
    window.addEventListener('keyup', this.keyupHandler)
  }

  on(...args) {
    this.emitter.on(...args)
  }

  off(...args) {
    this.emitter.off(...args)
  }

  setSpecialKeys(event) {
    const keys = []

    if (event.shiftKey) {
      keys.push('Shift')
    }

    if (event.ctrlKey) {
      keys.push('Control')
    }

    if (event.altKey) {
      keys.push('Alt')
    }

    if (event.metaKey) {
      keys.push('Meta')
    }

    this.specialKeys = keys
  }

  get keys() {
    return [...this.specialKeys, ...this.regularKeys]
  }

  get resolvedKeys() {
    return collect(this.constructor.resolveCodesFromKeys(this.keys))
      .unique()
      .toArray()
  }

  getKeyValue(event) {
    const key = this.constructor.keymap.find(item => item.code === event.code)

    if (!key) {
      return event.code
    }

    let { value } = key

    if (this.specialKeys.length === 1 && this.specialKeys.includes('Shift')) {
      value = key.withShift
    }

    if (this.specialKeys.length === 1 && this.specialKeys.includes('Alt')) {
      value = key.withAltGr
    }

    if (this.specialKeys.includes('Shift') && this.specialKeys.includes('Alt')) {
      value = key.withShiftAltGr
    }

    if (value === ' ') {
      return 'Space'
    }

    if (value === '') {
      return key.code
    }

    return value
  }

  static resolveCodesFromKeys(data = []) {
    const groups = getArrayDepth(data) > 1 ? data : [data]
    const resolvedGroups = groups.map(keys => {
      const resolvedKeys = keys.map(key => {
        let match = null

        match = this.keymap.find(item => item.value === key)

        if (match) {
          return match.value
        }

        match = this.keymap.find(item => item.withShift === key)

        if (match) {
          return ['Shift', match.value]
        }

        match = this.keymap.find(item => item.withAltGr === key)

        if (match) {
          return ['Alt', match.value]
        }

        match = this.keymap.find(item => item.withShiftAltGr === key)

        if (match) {
          return ['Shift', 'Alt', match.value]
        }

        return key
      })

      return collect(resolvedKeys)
        .flatten()
        .filter()
        .toArray()
    })

    return collect(resolvedGroups)
      .sortBy(keys => keys.length)
      .first()
  }

  static isPossible(keys = []) {
    // duplicated keys
    if (findDuplicatesInArray(keys).length) {
      return false
    }

    // only modifier keys
    if (keys.every(key => this.specialKeyNames.includes(key))) {
      return false
    }

    // blocked system shortcuts
    if (this.blockedShortcuts.some(blockedShortcut => isSameArray(blockedShortcut, keys))) {
      return false
    }

    return true
  }

  handleKeydown(event) {
    this.setSpecialKeys(event)
    const value = this.getKeyValue(event)

    if (this.isPressed(value)) {
      return
    }

    this.emitter.emit('update', event)

    if (this.constructor.specialKeyNames.includes(event.key)) {
      return
    }

    this.regularKeys.push(value)
    this.emitter.emit('shortcut', event)
    this.regularKeys = []
    this.specialKeys = []
  }

  handleKeyup(event) {
    this.setSpecialKeys(event)
    this.emitter.emit('update', event)
  }

  is(keys = []) {
    const checkedKeys = keys.map(key => key.toLowerCase())
    const pressedKeys = this.resolvedKeys.map(key => key.toLowerCase())
    return isSameArray(checkedKeys, pressedKeys)
  }

  isPressed(name = null) {
    return !!this.regularKeys.find(key => key.toLowerCase() === name.toLowerCase())
  }

  destroy() {
    this.emitter.destroy()
    window.removeEventListener('keydown', this.keydownHandler)
    window.removeEventListener('keyup', this.keyupHandler)
  }

}
