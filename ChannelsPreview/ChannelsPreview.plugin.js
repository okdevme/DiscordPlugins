/**
 * @name ChannelsPreview
 * @author arg0NNY
 * @authorLink https://github.com/okdevme/DiscordPlugins
 * @invite M8DBtcZjXD
 * @donate https://donationalerts.com/r/arg0nny
 * @version 2.1.16-local.11
 * @description Allows you to view recent messages in channels without switching to it.
 * @website https://github.com/okdevme/DiscordPlugins/tree/master/ChannelsPreview
 * @source https://raw.githubusercontent.com/okdevme/DiscordPlugins/master/ChannelsPreview/ChannelsPreview.plugin.js
 * @runAt idle
 */

/* ### CONFIG START ### */
const config = {
  info: {
    name: 'ChannelsPreview',
    version: '2.1.16-local.11',
    description: 'Allows you to view recent messages in channels without switching to it.'
  },
  changelog: [
    {
      type: 'fixed',
      title: 'Fixes',
      items: [
        'Updated author GitHub username.',
        'Local compatibility: skip unavailable Discord modules with a diagnostic instead of aborting startup.',
        'Local compatibility: when FocusRing is not a module, attach DM preview triggers from the DM row instead of disabling DMs.',
        'Local compatibility: omit only the dashed divider rule when that class module is missing.',
        'Local diagnostic: settings gear shows instrumentation when the settings UI cannot render. This does not restore previews.',
        'Settings use plain layout and checkboxes where Discord Stack or Switch is missing. Guild rows without a renderPopout anchor are wrapped in the existing preview popout.',
        'Chat darkening no longer throws when the page class is missing, and thread renders without a thread id no longer throw.',
        'A preview opens once the first message page is in the store. Older history beyond that page no longer keeps the popout hidden.',
        'The preview dialog renders when Discord’s messagesPopoutWrap class is missing.',
        'Missing preview scroller and divider use native DOM fallbacks. Message rows still use Discord’s message component.',
        'The native scroller follows new messages only while it is pinned to the newest end.',
        'Thread previews read providedChannel, the prop this Discord build destructures.'
      ]
    }
  ]
}
/* ### CONFIG END ### */

// Unofficial local compatibility patch based on arg0NNY's ChannelsPreview 2.1.16.
// Original metadata and upstream source URL are preserved above; this is not an official release.

const {
  DOM,
  Webpack,
  Patcher,
  React,
  Utils,
  Data,
  UI,
  Components
} = new BdApi(config.info.name)

const { Filters } = Webpack
const { ErrorBoundary } = Components

// Local compatibility helpers: only patch the exact legacy targets resolved above.
const unavailableFeatures = new Set()
const patchResults = []
const runtimeCounts = {
  triggerHandlers: 0,
  hoverEntries: 0,
  previewRequests: 0,
  decoratedMiss: 0,
  popoutAnchorHit: 0,
  popoutAnchorMiss: 0,
  popoutWraps: 0,
  popoutRenders: 0,
  popoutShouldShow: 0,
  popoutBlockedFetch: 0,
  popoutBlockedNoMessages: 0,
  previewDialogRenders: 0,
  previewRenderErrors: 0,
  darkenClass: 0,
  darkenRoot: 0,
  darkenMiss: 0,
  threadPropMiss: 0,
  popoutTargetReady: 0
}

const previewFetches = new Map()
const previewAnchors = new Map()
const diagnosticErrors = []

function sanitizeDiagnosticText (value) {
  return String(value == null ? '' : value)
    .replace(/mfa\.[A-Za-z0-9._-]{8,}/gi, '[redacted]')
    .replace(/\b[\w-]{20,}\.[\w-]{6,}\.[\w-]{20,}\b/g, '[redacted]')
    .replace(/\b\d{17,}\b/g, '[id]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 300)
}

function recordDiagnosticError (source, error) {
  if (!error) return
  const name = typeof error.name === 'string' && /^[A-Za-z][A-Za-z0-9]{0,40}$/.test(error.name)
    ? error.name
    : 'Error'
  const frames = (typeof error.stack === 'string' ? error.stack.split('\n') : [])
    .filter(line => /ChannelsPreview|\bplugin\.js\b/.test(line))
    .map(line => sanitizeDiagnosticText(line))
    .slice(0, 6)
  const message = sanitizeDiagnosticText(error.message)
  if (diagnosticErrors.some(entry => entry.source === source && entry.message === message)) return
  diagnosticErrors.push({ source, name, message, frames })
}

function isValidPatchTarget (target) {
  if (!Array.isArray(target) || target.length !== 2) return false
  const [module, methodName] = target
  const moduleType = typeof module
  return module != null
    && (moduleType === 'object' || moduleType === 'function')
    && typeof methodName === 'string'
    && typeof module[methodName] === 'function'
}

function disableFeature (feature) {
  unavailableFeatures.add(feature)
}

function patchAfter (feature, target, callback) {
  const ok = isValidPatchTarget(target)
  const methodName = Array.isArray(target) ? target[1] : ''
  patchResults.push({
    feature: feature === 'DM previews' && methodName === 'render' ? 'DM focus ring' : feature,
    ok
  })
  if (!ok) {
    disableFeature(feature)
    return false
  }
  Patcher.after(...target, callback)
  return true
}

function patchBefore (feature, target, callback) {
  const ok = isValidPatchTarget(target)
  patchResults.push({ feature, ok })
  if (!ok) {
    disableFeature(feature)
    return false
  }
  Patcher.before(...target, callback)
  return true
}

const MessageActions = Webpack.getByKeys('jumpToMessage', '_sendMessage')
const MessageStore = Webpack.getStore('MessageStore')
const Flux = Webpack.getByKeys('Store', 'connectStores')
const Dispatcher = Webpack.getModule(Filters.byKeys('dispatch', 'subscribe'), { searchExports: true })
const ChannelTypes = Webpack.getModule(Filters.byKeys('GUILD_TEXT'), { searchExports: true })

const findInReactTree = (tree, searchFilter) => Utils.findInTree(tree, searchFilter, { walkable: ['props', 'children', 'child', 'sibling'] })

// Used only when FocusRing itself is not a patchable module. Same walk keys as findInReactTree.
// Keeps the deepest match so an outer row wrapper does not hide the inner channel node.
function findDeepestInReactTree (tree, predicate) {
  let found = null
  let foundDepth = -1
  const seen = new WeakSet()
  const walk = (node, depth) => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child, depth + 1)
      return
    }
    if (!node || typeof node !== 'object') return
    if (seen.has(node)) return
    seen.add(node)
    if (predicate(node) && depth > foundDepth) {
      found = node
      foundDepth = depth
    }
    for (const key of ['props', 'children', 'child', 'sibling']) walk(node[key], depth + 1)
  }
  walk(tree, 0)
  return found
}

const Selectors = {
  Messages: Webpack.getByKeys('message', 'cozyMessage'),
  MessageDividers: Webpack.getByKeys('divider', 'unreadPill'),
  Popout: Webpack.getByKeys('messagesPopoutWrap'),
  Channel: Webpack.getByKeys('channel', 'interactive'),
  Typing: Webpack.getByKeys('typing', 'ellipsis'),
  ChatLayout: Webpack.getByKeys('sidebar', 'guilds'),
  AppView: Webpack.getByKeys('base', 'content'),
  Chat: Webpack.getByKeys('messagesWrapper', 'scrollerContent')
}

let settings = {}
const SUPPORTED_CHANNEL_TYPES = [
  ChannelTypes.GUILD_TEXT,
  ChannelTypes.GUILD_ANNOUNCEMENT,
  ChannelTypes.DM,
  ChannelTypes.GROUP_DM,
  ChannelTypes.PUBLIC_THREAD,
  ChannelTypes.PRIVATE_THREAD,
  ChannelTypes.GUILD_VOICE,
  ChannelTypes.GUILD_STAGE_VOICE
]

const PinToBottomScrollerAuto = Webpack.getModule(Filters.bySource('useImperativeHandle', 'getScrollerState', 'isScrolling'), {
  declarationFilter: m => Filters.byStrings('useImperativeHandle', 'getScrollerState', 'isScrolling')(m?.render)
})
const Popout = Webpack.getModule(m => Filters.byKeys('Animation')(m) && Filters.byStrings('renderPopout')(m?.prototype?.render), { searchExports: true })
const FieldSet = Webpack.getModule(Filters.byStrings('"fieldset"', '"legend"'), { searchExports: true })
const { RadioGroup } = Webpack.getMangled(Filters.bySource('"radiogroup"', 'getFocusableElements'), {
  RadioGroup: Filters.byStrings('label', 'description')
})
const Slider = Webpack.getModule(m => Filters.byKeys('stickToMarkers', 'initialValue')(m?.defaultProps), { searchExports: true })
const Switch = Webpack.getByStrings('checked', '.controlId')
const Stack = Webpack.getModule(m => Filters.byStrings('data-direction', 'data-justify')(m?.render), { searchExports: true })
const Divider = Webpack.getModule(Filters.byStrings('),style:{marginTop:'), { searchExports: true })
const Field = Webpack.getModule(Filters.byStrings('helperTextId', 'errorMessage'), { searchExports: true })
const { Checkbox, CheckboxTypes } = Webpack.getMangled(Filters.bySource('Checkbox:', 'is not a valid hex color'), {
  Checkbox: Filters.byStrings('innerClassName'),
  CheckboxTypes: Filters.byKeys('INVERTED')
})

const ChannelItemModule = Webpack.getModule(Filters.bySource('shouldIndicateNewChannel', 'MANAGE_CHANNELS'), { raw: true })
const ChannelItem = [...Webpack.getWithKey(Filters.byStrings('shouldIndicateNewChannel', 'MANAGE_CHANNELS'), { target: ChannelItemModule?.declarations })]
const VoiceChannelItem = [...Webpack.getWithKey(Filters.byStrings('PLAYING', 'MANAGE_CHANNELS'), { target: ChannelItemModule?.declarations })]
const StageVoiceChannelItem = [...Webpack.getWithKey(Filters.byStrings('getStageInstanceByChannel', 'MANAGE_CHANNELS'), { target: ChannelItemModule?.declarations })]
const DMChannelItem = [...Webpack.getWithKey(Filters.byStrings('getRecipientId', 'getTypingUsers'))]
const ChannelLink = [...Webpack.getWithKey(Filters.byStrings('hasActiveThreads', 'isGuildVocal'))]
const ThreadChannelItem = Webpack.getModule(Filters.bySource('thread', 'getVoiceStatesForChannel'), {
  declarationFilter: m => Filters.byStrings('thread', 'getVoiceStatesForChannel')(m?.type)
})
const AppearanceSettingsStore = Webpack.getByKeys('fontSize', 'fontScale')
const MessageComponent = Webpack.getModule(Filters.bySource('must not be a thread starter message'), {
  declarationFilter: m => Filters.byStrings('must not be a thread starter message')(m?.type)
})
const ThreadStarterMessage = Webpack.getModule(Filters.bySource('must be a thread starter message'), {
  declarationFilter: Filters.byStrings('must be a thread starter message')
})
const EmptyMessage = Webpack.getModule(Filters.bySource('canManageRoles', 'IS_JOIN_REQUEST_INTERVIEW_CHANNEL'), {
  declarationFilter: Filters.byStrings('canManageRoles', 'IS_JOIN_REQUEST_INTERVIEW_CHANNEL')
})
const FluxTypingUsers = Webpack.getByStrings('typingUsers', 'isThreadCreation')
const useStateFromStores = Webpack.getModule(Filters.byStrings('useStateFromStores'), { searchExports: true })
const AppView = [...Webpack.getWithKey(Filters.byStrings('CHANNEL_THREAD_VIEW', 'GUILD_DISCOVERY'), {
  target: Webpack.getModule(Filters.bySource('CHANNEL_THREAD_VIEW', 'GUILD_DISCOVERY', 'data-fullscreen'), { raw: true })?.declarations
})]
const ChannelChat = Webpack.getModule(m => Filters.byStrings('channelStream', 'oldestUnreadMessageId')(m?.type))
const ChannelStreamItemTypes = Webpack.getModule(Filters.byKeys('MESSAGE', 'DIVIDER'), { searchExports: true })
const MessageDivider = Webpack.getModule(m => Filters.byStrings('"separator"', 'isBeforeGroup')(m?.type?.render))
const Attachment = [...Webpack.getWithKey(Filters.byStrings('getObscureReason', 'obscurityControlClassName'))]
const Embed = Webpack.getByPrototypeKeys('renderAuthor', 'renderMedia')
const FocusRing = Webpack.getModule(Filters.bySource('focusProps', '"li"'), { declarationFilter: m => Filters.byStrings('focusProps', '"li"')(m?.render) })

function forceAppUpdate () {
  Dispatcher.dispatch({ type: 'DOMAIN_MIGRATION_START' })
  requestIdleCallback(() => Dispatcher.dispatch({ type: 'DOMAIN_MIGRATION_SKIP' }))
}

const ReducerStore = (() => {
  let n = 0

  function handleForceUpdate () {
    n += 1
  }

  return new class ReducerStore extends Flux.Store {
    getValue () {
      return n
    }
  }(Dispatcher, {
    CP__FORCE_UPDATE: handleForceUpdate
  })
})()

function useUpdater () {
  return useStateFromStores([ReducerStore], () => ReducerStore.getValue())
}

const ShownPreviewsStore = (() => {
  const shouldShow = new Set()
  const shown = new Set()
  const scrollerRefs = new Map()

  function handlePreviewShouldShow ({ channelId }) {
    shouldShow.add(channelId)
  }

  function handlePreviewShouldHide ({ channelId }) {
    shouldShow.delete(channelId)
  }

  function handlePreviewOpened ({ channelId, scrollerRef }) {
    shown.add(channelId)
    if (scrollerRef) scrollerRefs.set(channelId, scrollerRef)
  }

  function handlePreviewClosed ({ channelId }) {
    shown.delete(channelId)
    scrollerRefs.delete(channelId)
  }

  return new class OpenedPreviewsStore extends Flux.Store {
    shouldShow (channelId) {
      return shouldShow.has(channelId)
    }

    isShown (channelId) {
      return shown.has(channelId)
    }

    hasAnyShown () {
      return shown.size > 0
    }

    getScrollerRef (channelId) {
      return scrollerRefs.get(channelId)
    }
  }(Dispatcher, {
    CP__PREVIEW_SHOULD_SHOW: handlePreviewShouldShow,
    CP__PREVIEW_SHOULD_HIDE: handlePreviewShouldHide,
    CP__PREVIEW_SHOWN: handlePreviewOpened,
    CP__PREVIEW_HIDDEN: handlePreviewClosed
  })
})()

const KeyboardStore = (() => {
  let isShiftKeyPressed = false

  function handleKeyDown ({ event }) {
    if (event.code === 'ShiftLeft') isShiftKeyPressed = true
  }

  function handleKeyUp ({ event }) {
    if (event.code === 'ShiftLeft') isShiftKeyPressed = false
  }

  return new class KeyboardStore extends Flux.Store {
    isShiftKeyPressed () {
      return isShiftKeyPressed
    }
  }(Dispatcher, {
    CP__KEY_DOWN: handleKeyDown,
    CP__KEY_UP: handleKeyUp
  })
})()

function useIsShiftKeyPressed () {
  return useStateFromStores([KeyboardStore], () => KeyboardStore.isShiftKeyPressed())
}

function isGroupStarter (channelStreamItem) {
  return channelStreamItem?.type === ChannelStreamItemTypes.MESSAGE
    && channelStreamItem.content.id === channelStreamItem.groupId
}

const DMChannelContext = React.createContext({ channel: null, selected: false })
const PreviewContext = React.createContext({ channel: null })

function useGenerateChannelStream({ channel, messageCountLimit }) {
  const value = ChannelChat.type({ channel })
  const { channelStream } = findInReactTree(value, m => m?.channelStream)
  if (messageCountLimit == null) return channelStream

  // Limit the message stream by message count while keeping the dividers
  const slicedStream = []
  let count = 0
  for (const item of channelStream.toReversed()) {
    if (count >= messageCountLimit) {
      if (item.type !== ChannelStreamItemTypes.DIVIDER)
        continue

      slicedStream.unshift(item)
      break
    }

    slicedStream.unshift(item)
    count += [ChannelStreamItemTypes.MESSAGE, ChannelStreamItemTypes.THREAD_STARTER_MESSAGE].includes(item.type)
  }

  return slicedStream
}

function isRenderableType (type) {
  return typeof type === 'function' || (type != null && typeof type === 'object')
}

function describeThreadArg (value) {
  if (value == null) return 'missing'
  const kind = typeof value
  if (kind !== 'object') return kind
  const keys = Object.keys(value).filter(key => /^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(key)).slice(0, 8)
  return 'object:' + (keys.join(',') || 'none')
}

// Native stand-in. Not Discord's divider component.
function PreviewDividerFallback ({ className, children }) {
  return React.createElement('div', {
    className: className || undefined,
    role: 'separator',
    children
  })
}

// Native stand-in. Not Discord's pin-to-bottom scroller.
// Column-reverse keeps the newest end at scrollTop 0. While pinned, later
// renders return there. A scroll away stays put until the user returns.
function PreviewScrollerFallback ({ scrollerRef, className, children }) {
  const nodeRef = React.useRef(null)
  const pinnedRef = React.useRef(true)
  React.useEffect(() => {
    const node = nodeRef.current
    if (scrollerRef) {
      scrollerRef.current = { getScrollerNode: () => nodeRef.current }
    }
    if (!node || typeof node.addEventListener !== 'function') {
      if (node && pinnedRef.current) node.scrollTop = 0
      return () => {
        if (scrollerRef) scrollerRef.current = null
      }
    }
    const onScroll = () => {
      pinnedRef.current = node.scrollTop <= 2
    }
    node.addEventListener('scroll', onScroll)
    if (pinnedRef.current) node.scrollTop = 0
    return () => {
      node.removeEventListener('scroll', onScroll)
      if (scrollerRef) scrollerRef.current = null
    }
  }, [])
  React.useEffect(() => {
    const node = nodeRef.current
    if (!node || !pinnedRef.current) return
    if (node.scrollTop > 2) node.scrollTop = 0
  })
  return React.createElement('div', {
    ref: nodeRef,
    className: className,
    style: {
      overflowY: 'auto',
      height: '100%',
      display: 'flex',
      flexDirection: 'column-reverse'
    },
    children
  })
}

function PreviewDialog ({ channel, messages }) {
  const scrollerRef = React.useRef(null)

  React.useEffect(() => {
    Dispatcher.dispatch({ type: 'CP__PREVIEW_SHOWN', channelId: channel.id, scrollerRef })
    return () => Dispatcher.dispatch({ type: 'CP__PREVIEW_HIDDEN', channelId: channel.id })
  }, [])

  const messageCountLimit = settings.appearance.messagesCount
  const messageGroupSpacing = settings.appearance.groupSpacingSync
    ? (AppearanceSettingsStore.messageGroupSpacing ?? 16)
    : settings.appearance.groupSpacing

  const channelStream = [
    !messages.hasMoreBefore && messages.length <= messageCountLimit
      ? { type: 'EMPTY_MESSAGE' }
      : { type: ChannelStreamItemTypes.DIVIDER, content: `Displaying last ${messageCountLimit} messages`, cut: true }
  ].concat(
    useGenerateChannelStream({
      channel,
      messageCountLimit
    })
  )

  const channelStreamMarkup = channelStream
    .map((item, index) => {
      switch (item.type) {
        case 'EMPTY_MESSAGE':
          return React.createElement(EmptyMessage, { channel })
        case ChannelStreamItemTypes.DIVIDER: {
          const dividerProps = {
            className: item.cut ? 'CP__divider-cut' : '',
            isUnread: !!item.unreadId,
            isBeforeGroup: !item.content && isGroupStarter(channelStream[index + 1]),
            children: item.content
          }
          return isRenderableType(MessageDivider)
            ? React.createElement(MessageDivider, dividerProps)
            : React.createElement(PreviewDividerFallback, dividerProps)
        }
        case ChannelStreamItemTypes.MESSAGE:
        case ChannelStreamItemTypes.THREAD_STARTER_MESSAGE:
          return React.createElement(
            item.type === ChannelStreamItemTypes.THREAD_STARTER_MESSAGE ? ThreadStarterMessage : MessageComponent,
            {
              channel,
              message: item.content,
              groupId: item.groupId,
              id: `chat-messages-${item.content.id}`,
              compact: settings.appearance.displayMode === 'compact'
            }
          )
      }
    })

  const popoutClass = Selectors.Popout && Selectors.Popout.messagesPopoutWrap
  const scrollerClass = Selectors.Chat && Selectors.Chat.scrollerContent
  return React.createElement(
    'div',
    {
      className: 'CP__popout group-spacing-' + messageGroupSpacing +
        (typeof popoutClass === 'string' && popoutClass ? ' ' + popoutClass : ''),
      style: {
        height: (settings.appearance.popoutHeight ?? 30) + 'vh'
      }
    },
    React.createElement(PreviewContext.Provider, {
      value: { channel },
      children: React.createElement(isRenderableType(PinToBottomScrollerAuto) ? PinToBottomScrollerAuto : PreviewScrollerFallback, {
        ref: isRenderableType(PinToBottomScrollerAuto) ? scrollerRef : undefined,
        scrollerRef,
        className: 'CP__scroller',
        contentClassName: typeof scrollerClass === 'string' ? scrollerClass : undefined,
        onResize: () => {}, // Causes error if not provided
        onScroll: () => {}, // And this one is just to be safe :)
        children: React.createElement('div', {
          className: 'CP__container',
          children: [
            ...channelStreamMarkup,
            settings.appearance.typingUsers !== false && React.createElement(FluxTypingUsers, { channel })
          ]
        })
      })
    })
  )
}

function ChannelPopout ({ channel, selected, messages, children, shouldShow: _shouldShow = false, ...props }) {
  runtimeCounts.popoutRenders += 1
  const isShiftKeyPressed = useIsShiftKeyPressed()
  const messageCount = messages && typeof messages.length === 'number' ? messages.length : null
  if (messageCount == null) runtimeCounts.popoutBlockedNoMessages += 1

  const shouldShow = messageCount != null && _shouldShow && !selected
    && (settings.trigger.displayOn !== 'shift-hover' || isShiftKeyPressed)
    && (settings.behaviour.nsfw !== 'hide' || !channel?.nsfw)
  const hasMore = !!(messages && (messages.hasMoreBefore || messages.hasMoreAfter))
  const fetchState = channel && channel.id != null
    ? (previewFetches.get(channel.id) || { pending: false, settled: false })
    : { pending: false, settled: false }
  // hasMoreBefore means older history exists. It is not an in-flight fetch.
  // Hide only the empty first page until that fetch settles.
  const waitingForFirstPage = messageCount === 0 && hasMore && !fetchState.settled
  if (shouldShow && waitingForFirstPage) runtimeCounts.popoutBlockedFetch += 1
  const reveal = shouldShow && !waitingForFirstPage
  if (reveal) {
    runtimeCounts.popoutShouldShow += 1
    const target = props.targetElementRef && props.targetElementRef.current
    if (target != null && typeof target === 'object') runtimeCounts.popoutTargetReady += 1
  }

  React.useEffect(() => {
    if (!shouldShow || !channel || channel.id == null || messageCount == null) return
    if (!(messageCount < settings.appearance.messagesCount && hasMore)) return
    const state = previewFetches.get(channel.id) || { pending: false, settled: false }
    if (state.pending || state.settled) return
    previewFetches.set(channel.id, state)
    let result
    try {
      result = MessageActions.fetchMessages({
        channelId: channel.id,
        limit: settings.appearance.messagesCount
      })
    } catch (error) {
      state.settled = true
      recordDiagnosticError('preview-fetch', error)
      return
    }
    const finish = () => {
      state.pending = false
      state.settled = true
      Dispatcher.dispatch({ type: 'CP__FORCE_UPDATE' })
    }
    if (result && typeof result.then === 'function') {
      state.pending = true
      result.then(finish, finish)
    } else {
      finish()
    }
  }, [shouldShow, messageCount, hasMore])
  React.useEffect(
    () => () => channel && Dispatcher.dispatch({ type: 'CP__PREVIEW_SHOULD_HIDE', channelId: channel.id }),
    [channel && channel.id]
  )

  const row = typeof children === 'function' ? children : () => children
  return React.createElement(Popout, {
    position: 'right',
    align: 'center',
    renderPopout: () => {
      runtimeCounts.previewDialogRenders += 1
      return React.createElement(PreviewRenderBoundary, {
        children: React.createElement(PreviewDialog, { channel, messages })
      })
    },
    children: row,
    shouldShow: reveal,
    spacing: 16,
    disablePointerEvents: true,
    ...props
  })
}

class PreviewRenderBoundary extends React.Component {
  constructor (props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError () {
    return { failed: true }
  }
  componentDidCatch (error) {
    runtimeCounts.previewRenderErrors += 1
    recordDiagnosticError('preview-render', error)
  }
  render () {
    if (this.state.failed) return null
    return this.props.children
  }
}

function isPresent (value) {
  return value != null && (typeof value === 'object' || typeof value === 'function')
}

function moduleFlags () {
  const dividerClass = Selectors.MessageDividers?.divider
  let bdVersion = 'unavailable'
  try {
    const version = BdApi && (BdApi.version || BdApi.Version)
    if (typeof version === 'string') bdVersion = sanitizeDiagnosticText(version)
  } catch (error) {
    bdVersion = 'unavailable'
  }
  return {
    bdVersion,
    flags: {
      channelItem: isValidPatchTarget(ChannelItem),
      voiceItem: isValidPatchTarget(VoiceChannelItem),
      stageItem: isValidPatchTarget(StageVoiceChannelItem),
      dmItem: isValidPatchTarget(DMChannelItem),
      channelLink: isValidPatchTarget(ChannelLink),
      threadItem: isValidPatchTarget([ThreadChannelItem, 'type']),
      appView: isValidPatchTarget(AppView),
      attachment: isValidPatchTarget(Attachment),
      embed: isValidPatchTarget([Embed && Embed.prototype, 'render']),
      focusRing: isValidPatchTarget([FocusRing, 'render']),
      dividerClass: typeof dividerClass === 'string' && /^[A-Za-z0-9_-]+$/.test(dividerClass),
      appViewClass: typeof (Selectors.AppView && Selectors.AppView.page) === 'string',
      popout: isPresent(Popout),
      stack: isPresent(Stack),
      fieldSet: isPresent(FieldSet),
      radioGroup: isPresent(RadioGroup),
      slider: isPresent(Slider),
      switchItem: isPresent(Switch),
      divider: isPresent(Divider),
      field: isPresent(Field),
      checkbox: isPresent(Checkbox),
      reactDOM: isPresent(typeof BdApi !== 'undefined' && BdApi.ReactDOM)
    }
  }
}

function buildDiagnosticReport () {
  const info = moduleFlags()
  const lines = [
    'ChannelsPreview diagnostic instrumentation',
    'Not a settings repair. Stored settings were not modified. This panel does not restore previews.',
    'pluginVersion: ' + config.info.version,
    'bdVersion: ' + info.bdVersion,
    'modules:'
  ]
  for (const name of Object.keys(info.flags)) {
    lines.push('  ' + name + '=' + info.flags[name])
  }
  lines.push('patches:')
  if (!patchResults.length) lines.push('  none')
  for (const result of patchResults) lines.push('  ' + result.feature + '=' + result.ok)
  lines.push(
    'counts:',
    '  triggerHandlers=' + runtimeCounts.triggerHandlers,
    '  hoverEntries=' + runtimeCounts.hoverEntries,
    '  previewRequests=' + runtimeCounts.previewRequests,
    '  decoratedMiss=' + runtimeCounts.decoratedMiss,
    '  popoutAnchorHit=' + runtimeCounts.popoutAnchorHit,
    '  popoutAnchorMiss=' + runtimeCounts.popoutAnchorMiss,
    '  popoutWraps=' + runtimeCounts.popoutWraps,
    '  popoutRenders=' + runtimeCounts.popoutRenders,
    '  popoutShouldShow=' + runtimeCounts.popoutShouldShow,
    '  popoutBlockedFetch=' + runtimeCounts.popoutBlockedFetch,
    '  popoutBlockedNoMessages=' + runtimeCounts.popoutBlockedNoMessages,
    '  previewDialogRenders=' + runtimeCounts.previewDialogRenders,
    '  previewRenderErrors=' + runtimeCounts.previewRenderErrors,
    '  darkenClass=' + runtimeCounts.darkenClass,
    '  darkenRoot=' + runtimeCounts.darkenRoot,
    '  darkenMiss=' + runtimeCounts.darkenMiss,
    '  threadPropMiss=' + runtimeCounts.threadPropMiss,
    '  popoutTargetReady=' + runtimeCounts.popoutTargetReady,
    'errors:'
  )
  if (!diagnosticErrors.length) lines.push('  none')
  for (const entry of diagnosticErrors) {
    lines.push('  ' + entry.source + ' | ' + entry.name + ' | ' + entry.message)
    if (!entry.frames.length) lines.push('  stack: none')
    for (const frame of entry.frames) lines.push('  ' + frame)
  }
  return lines.join('\n')
}

function SettingsStack ({ children, gap = 16 }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children]
  return React.createElement('div', {
    style: { display: 'flex', flexDirection: 'column', gap: gap + 'px' }
  }, ...items)
}

function NativeSwitch ({ label, description, checked, onChange }) {
  return React.createElement('label', {
    style: { display: 'flex', gap: '8px', alignItems: 'flex-start' }
  }, [
    React.createElement('input', {
      type: 'checkbox',
      checked: !!checked,
      onChange: event => onChange(event.currentTarget.checked)
    }),
    React.createElement('span', null, [
      label,
      description ? React.createElement('div', null, description) : null
    ])
  ])
}

class SettingsPanelBoundary extends React.Component {
  constructor (props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError () {
    return { failed: true }
  }
  componentDidCatch (error) {
    recordDiagnosticError('settings-render', error)
  }
  render () {
    if (this.state.failed) {
      return React.createElement('pre', {
        id: 'ChannelsPreview-diagnostic-text',
        style: { whiteSpace: 'pre-wrap' }
      }, buildDiagnosticReport())
    }
    return this.props.children
  }
}

function ChannelPopoutBackdrop () {
  const shouldShow = useStateFromStores([ShownPreviewsStore], () => ShownPreviewsStore.hasAnyShown())

  return shouldShow ? React.createElement('div', {
    className: 'CP__backdrop',
    style: { opacity: settings.appearance.darkenLevel }
  }) : null
}

module.exports = class ChannelsPreview {
  start () {
    if (this.started) return
    this.started = true

    try {
      this.injectCSS()

      this.patchChannelItem()
      this.patchChannelLink()
      this.patchThreadChannelItem()
      this.patchDMChannelItem()
      this.patchAppView()
      this.patchMedia()
      this.attachKeyboardEvents()

      if (unavailableFeatures.size) {
        const features = [...unavailableFeatures].join(', ')
        console.warn(`[ChannelsPreview] Unavailable Discord modules; disabled: ${features}`)
        UI.showToast(`ChannelsPreview: disabled unavailable features: ${features}. Other previews may still work.`, {
          type: 'warning',
          timeout: 10000
        })
      }

      forceAppUpdate()
    } catch (error) {
      recordDiagnosticError('start', error)
      this.stop()
      throw error
    }
  }

  showPopout (channel) {
    runtimeCounts.previewRequests += 1
    if (!SUPPORTED_CHANNEL_TYPES.includes(channel.type)) return

    Dispatcher.dispatch({ type: 'CP__PREVIEW_SHOULD_SHOW', channelId: channel.id })
  }

  closePopout (channelId) {
    Dispatcher.dispatch({ type: 'CP__PREVIEW_SHOULD_HIDE', channelId })
  }

  makeChannelItemCallback () {
    let isPatched = false
    return (self, [{ channel }], value) => {
      value.props.CP__state = useUpdater()
      value.props.messages = useStateFromStores([MessageStore], () => MessageStore.getMessages(channel.id))
      value.props.CP__shouldShowPopout = useStateFromStores([ShownPreviewsStore], () => ShownPreviewsStore.shouldShow(channel.id))

      if (!value?.type?.DecoratedComponent?.prototype?.render) {
        runtimeCounts.decoratedMiss += 1
        return this.wrapChannelPopout({
          value,
          channel,
          messages: value.props.messages,
          selected: self?.props?.selected,
          shouldShow: value.props.CP__shouldShowPopout
        })
      }
      if (isPatched) return
      isPatched = true

      Patcher.after(value.type.DecoratedComponent.prototype, 'render', (self, args, value) => {
        const { channel, messages, selected, CP__shouldShowPopout: shouldShow } = self.props

        if (!channel || !SUPPORTED_CHANNEL_TYPES.includes(channel.type)) return

        const popout = findInReactTree(value, m => m?.props?.renderPopout)
        if (!popout) {
          runtimeCounts.popoutAnchorMiss += 1
          return this.wrapChannelPopout({ value, channel, messages, selected, shouldShow })
        }
        runtimeCounts.popoutAnchorHit += 1

        if (!self.channelItemRef && !self.__channelItemRef) {
          self.__channelItemRef = React.createRef(null)
        }
        if (self.__channelItemRef && typeof popout.props.children === 'function') {
          const ref = self.__channelItemRef
          Patcher.after(popout.props, 'children', (self, args, value) => {
            Patcher.after(value.props, 'children', (self, args, value) => {
              value.props.ref = ref
            })
          })
        }

        const targetElementRef = self.channelItemRef ?? self.__channelItemRef
        if (!targetElementRef) return

        popout.type = ChannelPopout
        popout.props = {
          targetElementRef,
          channel,
          selected,
          messages,
          children: popout.props.children,
          shouldShow,
          onRequestClose: () => this.closePopout(channel.id)
        }
      })
    }
  }

  wrapChannelPopout ({ value, channel, messages, selected, shouldShow }) {
    if (!channel) return value
    if (value && value.props && !value.props.ref) value.props.ref = React.createRef(null)
    const linkAnchor = channel && channel.id != null ? previewAnchors.get(channel.id) : null
    runtimeCounts.popoutWraps += 1
    return React.createElement(ChannelPopout, {
      targetElementRef: linkAnchor || (value && value.props ? value.props.ref : null),
      channel,
      selected: !!selected,
      messages,
      shouldShow,
      onRequestClose: () => this.closePopout(channel.id),
      children: () => value
    })
  }

  patchLink ({ link, channel, timeoutRef = React.useRef(null), selected }) {
    const openPopout = () => !selected && this.showPopout(channel)

    if (settings.trigger.displayOn === 'mwheel') {
      const preventDefault = (_, [e]) => e.button === 1 && e.preventDefault()
      Patcher.before(link.props, 'onMouseDown', preventDefault)
      Patcher.before(link.props, 'onAuxClick', preventDefault)
      Patcher.before(link.props, 'onMouseUp', (_, [e]) => e.button === 1 && openPopout())
    }

    if (['hover', 'shift-hover'].includes(settings.trigger.displayOn)) {
      Patcher.before(link.props, 'onMouseEnter', () => {
        runtimeCounts.hoverEntries += 1
        timeoutRef.current = setTimeout(openPopout, settings.trigger.hoverDelay * 1000)
      })
      runtimeCounts.triggerHandlers += 1
    }

    Patcher.before(link.props, 'onMouseLeave', () => {
      clearTimeout(timeoutRef.current)
      this.closePopout(channel.id)
    })

    let ref = React.useRef(null)
    switch (typeof link.props.ref) {
      case 'function': {
        const original = link.props.ref
        link.props.ref = el => {
          ref.current = el
          original(el)
        }
        break
      }
      case 'object': {
        ref = link.props.ref
        break
      }
      default: {
        link.props.ref = ref
        break
      }
    }
    if (channel && channel.id != null && ref) previewAnchors.set(channel.id, ref)

    React.useEffect(() => {
      const onWheel = e => {
        if (settings.behaviour.scroll === 'shift' && !e.shiftKey) return

        const scroller = ShownPreviewsStore.getScrollerRef(channel.id)?.current?.getScrollerNode()
        if (!scroller) return

        scroller.scrollTop += e.deltaY
        e.preventDefault()
      }
      ref.current?.addEventListener('wheel', onWheel, { passive: false })
      return () => ref.current?.removeEventListener('wheel', onWheel, { passive: false })
    }, [])
  }

  patchChannelItem () {
    patchAfter('text channel previews', ChannelItem, this.makeChannelItemCallback())
    patchAfter('voice channel previews', VoiceChannelItem, this.makeChannelItemCallback())
    patchAfter('stage channel previews', StageVoiceChannelItem, this.makeChannelItemCallback())
  }

  patchChannelLink () {
    patchAfter('channel link triggers', ChannelLink, (self, [{ channel, selected }], value) => {
      const link = findInReactTree(value, m => m?.props?.role && m?.props?.target)
      if (!link) return

      this.patchLink({ link, channel, selected })
    })
  }

  patchThreadChannelItem () {
    patchAfter('thread previews', [ThreadChannelItem, 'type'], (self, args, value) => {
      const props = args && args[0]
      // This build's original type() destructures {providedChannel} from its first argument.
      const thread = props && (props.thread || props.providedChannel)
      const isSelectedChannel = props && props.isSelectedChannel
      if (!thread || thread.id == null) {
        runtimeCounts.threadPropMiss += 1
        recordDiagnosticError('thread-preview', new Error(
          'threadType=' + (thread == null ? 'missing' : typeof thread) +
          '; arg0=' + describeThreadArg(props) +
          '; self=' + describeThreadArg(self) +
          '; argc=' + (args && typeof args.length === 'number' ? args.length : 0)
        ))
        return
      }
      useUpdater()
      const messages = useStateFromStores([MessageStore], () => MessageStore.getMessages(thread.id))
      const shouldShow = useStateFromStores([ShownPreviewsStore], () => ShownPreviewsStore.shouldShow(thread.id))

      const linkWrapper = findInReactTree(value, m => m?.children?.props?.className?.includes('iconVisibility'))
      if (!linkWrapper) return

      this.patchLink({
        link: linkWrapper.children,
        channel: thread,
        selected: isSelectedChannel
      })

      const { children } = linkWrapper
      linkWrapper.children = React.createElement(ChannelPopout, {
        targetElementRef: linkWrapper.children?.props?.ref,
        channel: thread,
        selected: isSelectedChannel,
        messages,
        children: () => children,
        shouldShow,
        onRequestClose: () => this.closePopout(thread.id)
      })
      linkWrapper.children.children = children // Allow other plugins to modify the children
    })
  }

  attachDMPreviewLink (tree, channel, selected) {
    const channelClass = Selectors.Channel?.channel
    if (typeof channelClass !== 'string' || !channelClass) return

    // Same relationship as the FocusRing.render hook: the channel node receives className,
    // and its child is the link passed to patchLink.
    const ring = findDeepestInReactTree(tree, node => {
      const className = node?.props?.className
      return typeof className === 'string'
        && className.includes(channelClass)
        && node.props.children?.props
    })
    if (!ring) return

    this.patchLink({
      link: ring.props.children,
      channel,
      selected
    })
  }

  patchDMChannelItem () {
    // The DM row module is required. FocusRing is only the legacy place the link was patched.
    if (!isValidPatchTarget(DMChannelItem)) {
      disableFeature('DM previews')
      return
    }

    const focusRingReady = isValidPatchTarget([FocusRing, 'render'])
    if (!focusRingReady) {
      console.warn('[ChannelsPreview] FocusRing is not a module; DM preview triggers attach inside the DM row instead of FocusRing.render.')
    }

    patchAfter('DM previews', DMChannelItem, (self, [{ channel, selected }], value) => {
      useUpdater()
      const messages = useStateFromStores([MessageStore], () => MessageStore.getMessages(channel.id))
      const shouldShow = useStateFromStores([ShownPreviewsStore], () => ShownPreviewsStore.shouldShow(channel.id))

      const ref = React.useRef(null)
      if (!value.props.ref) value.props.ref = ref

      if (!focusRingReady) this.attachDMPreviewLink(value, channel, selected)

      const popout = React.createElement(ChannelPopout, {
        targetElementRef: value.props.ref,
        channel,
        selected,
        messages,
        shouldShow,
        onRequestClose: () => this.closePopout(channel.id),
        children: () => React.createElement(DMChannelContext.Provider, {
          value: { channel },
          children: value
        })
      })
      popout.children = value // Allow other plugins to modify the children

      return popout
    })

    if (!focusRingReady) return

    patchAfter('DM previews', [FocusRing, 'render'], (self, [{ className }], value) => {
      if (!className?.includes(Selectors.Channel.channel)) return

      const { channel, selected } = React.useContext(DMChannelContext)
      if (!channel) return

      this.patchLink({
        link: value.props.children,
        channel,
        selected
      })
    })
  }

  patchAppView () {
    patchAfter('chat darkening', AppView, (self, args, value) => {
      useUpdater()
      if (!settings.appearance.darkenChat) return

      const pageClass = Selectors.AppView && Selectors.AppView.page
      if (typeof pageClass === 'string' && pageClass) {
        const page = findInReactTree(value, m => typeof m?.className === 'string' && m.className.includes(pageClass))
        if (!page) return
        page.children = [
          page.children,
          React.createElement(ChannelPopoutBackdrop)
        ]
        runtimeCounts.darkenClass += 1
        return
      }
      if (value && typeof value === 'object') {
        const current = value.children != null ? value.children : value.props && value.props.children
        const next = [current, React.createElement(ChannelPopoutBackdrop)]
        value.children = next
        if (value.props) value.props.children = next
        runtimeCounts.darkenRoot += 1
        return
      }
      runtimeCounts.darkenMiss += 1
      recordDiagnosticError('chat-darkening', new Error('page class missing and app render result is not an object'))
    })
  }

  patchMedia () {
    const OBSCURE_REASON = 'explicit_content'

    patchBefore('NSFW attachment blurring', Attachment, (self, [props]) => {
      const { channel } = React.useContext(PreviewContext)
      if (settings.behaviour.nsfw === 'obscure' && channel?.nsfw)
        props.getObscureReason = () => OBSCURE_REASON
    })

    patchBefore('NSFW embed blurring', [Embed?.prototype, 'render'], ({ props, context }) => {
      if (settings.behaviour.nsfw === 'obscure' && context.channel?.nsfw && props.embed.image)
        props.obscureReason = OBSCURE_REASON
    })
    if (isValidPatchTarget([Embed?.prototype, 'render'])) Embed.contextType = PreviewContext
  }

  attachKeyboardEvents () {
    this.clearKeyboardEvents()
    this.keyboardEvents = {
      onKeyDown: e => Dispatcher.dispatch({ type: 'CP__KEY_DOWN', event: e }),
      onKeyUp: e => Dispatcher.dispatch({ type: 'CP__KEY_UP', event: e })
    }
    addEventListener('keydown', this.keyboardEvents.onKeyDown)
    addEventListener('keyup', this.keyboardEvents.onKeyUp)
  }

  clearKeyboardEvents () {
    if (!this.keyboardEvents) return
    removeEventListener('keydown', this.keyboardEvents.onKeyDown)
    removeEventListener('keyup', this.keyboardEvents.onKeyUp)
    this.keyboardEvents = null
  }

  injectCSS () {
    // Discord's divider class restyles the cut marker. The marker's own
    // .CP__divider-cut rules do not need that module.
    const dividerClass = Selectors.MessageDividers?.divider
    const dividerRule = typeof dividerClass === 'string' && /^[A-Za-z0-9_-]+$/.test(dividerClass)
      ? `
        .CP__divider-cut.${dividerClass},
        .CP__divider-cut .${dividerClass} {
            border-style: dashed;
        }`
      : ''
    if (!dividerRule) {
      console.warn('[ChannelsPreview] Message divider class is missing; dashed cut-divider styling omitted.')
    }

    //language=CSS
    DOM.addStyle(`${config.info.name}-style`, `
        .CP__popout {
            pointer-events: none;
            background-color: var(--bg-overlay-chat, var(--background-base-lower)) !important;
            border-radius: 10px;
            height: 30vh;
            min-height: 150px;
            width: 50vw;
            min-width: 350px;
            overflow: hidden;
            margin-top: calc(var(--custom-app-top-bar-height) + 8px);
        }

        .CP__popout * {
            pointer-events: none !important;
        }

        .CP__container {
            padding-bottom: 25px;
        }

        .CP__container > * {
            list-style: none;
        }

        .CP__scroller {
            display: flex;
            flex-direction: column-reverse;
            overflow-anchor: auto;
        }

        .CP__backdrop {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: #000;
            pointer-events: none;
            opacity: 0;
            transition: .3s opacity;
            z-index: 1000;
        }

        .CP__divider-cut {
            margin-top: 40px !important;
        }${dividerRule}
        .CP__divider-cut span {
            font-weight: 400;
        }

        .CP__scroll-hint {
            position: absolute;
            inset: 0;
            z-index: 100;
            background: rgba(0, 0, 0, .6);
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            animation: CP__fadeIn .3s ease;
        }

        @keyframes CP__fadeIn {
            0% {
                opacity: 0
            }
            100% {
                opacity: 1
            }
        }

        #${this.getSettingsPanelId()} {
            color: var(--text-strong);
            line-height: 1;
        }

        #${this.getSettingsPanelId()} .plugin-inputs {
            box-sizing: border-box;
            padding: 0 10px;
        }
    `)
  }

  clearCSS () {
    DOM.removeStyle(`${config.info.name}-style`)
  }

  stop () {
    this.started = false
    this.clearCSS()
    Patcher.unpatchAll()
    this.clearKeyboardEvents()
    if (Embed) delete Embed.contextType

    forceAppUpdate()
  }

  getSettingsPanelId () {
    return `${config.info.name}-settings`
  }

  constructor () {
    this.defaultSettings = {
      trigger: {
        displayOn: 'hover',
        hoverDelay: .4
      },
      behaviour: {
        scroll: 'default',
        nsfw: 'obscure'
      },
      appearance: {
        popoutHeight: 40,
        darkenChat: true,
        darkenLevel: .3,
        displayMode: 'cozy',
        groupSpacingSync: true,
        groupSpacing: 16,

        // Belongs to Behaviour (located here for backwards compatibility)
        messagesCount: 20,
        typingUsers: true
      }
    }

    this.settings = this.loadSettings(this.defaultSettings)
    settings = this.settings

    this.showChangelogIfNeeded()
  }

  loadSettings (defaults = {}) {
    return Utils.extend({}, defaults, Data.load('settings'))
  }
  saveSettings (settings = this.settings) {
    return Data.save('settings', settings)
  }

  showChangelogIfNeeded () {
    const currentVersionInfo = Utils.extend(
      { version: config.info.version, hasShownChangelog: false },
      Data.load('currentVersionInfo')
    )
    if (currentVersionInfo.version === config.info.version && currentVersionInfo.hasShownChangelog) return

    this.showChangelog()
    Data.save('currentVersionInfo', { version: config.info.version, hasShownChangelog: true })
  }
  showChangelog () {
    return UI.showChangelogModal({
      title: config.info.name,
      subtitle: 'Version ' + config.info.version,
      changes: config.changelog
    })
  }

  getSettingsPanel () {
    const plugin = this

    function SettingsPanel () {
      const [_, forceUpdate] = React.useReducer(x => x + 1, 0)
      const onUpdate = React.useCallback(() => {
        plugin.saveSettings()
        settings = plugin.settings
        Dispatcher.dispatch({ type: 'CP__FORCE_UPDATE' })
        forceUpdate()
      }, [])

      return React.createElement(SettingsStack, {
        id: plugin.getSettingsPanelId(),
        gap: 32,
        children: [
          React.createElement(FieldSet, {
            label: 'Trigger',
            children: React.createElement(SettingsStack, {
              gap: 16,
              children: [
                React.createElement(RadioGroup, {
                  options: [
                    { name: 'Hover', value: 'hover' },
                    { name: 'Shift + Hover', value: 'shift-hover' },
                    { name: 'Mouse Wheel Click', value: 'mwheel' }
                  ],
                  value: plugin.settings.trigger.displayOn,
                  onChange: ({ value }) => {
                    plugin.settings.trigger.displayOn = value
                    onUpdate()
                  }
                }),
                ['hover', 'shift-hover'].includes(plugin.settings.trigger.displayOn) && (
                  React.createElement(Slider, {
                    label: 'Hover Delay',
                    description: 'The amount of time to hover before triggering the preview.',
                    initialValue: plugin.settings.trigger.hoverDelay,
                    onValueChange: value => {
                      plugin.settings.trigger.hoverDelay = value
                      onUpdate()
                    },
                    defaultValue: plugin.defaultSettings.trigger.hoverDelay,
                    minValue: .1,
                    maxValue: 2,
                    markers: [...Array(20).keys()].map(n => (n + 1) / 10),
                    stickToMarkers: true,
                    onMarkerRender: m => m % .5 === 0 || m === .1 || m === plugin.defaultSettings.trigger.hoverDelay
                      ? m.toFixed(1) + 's' : ''
                  })
                )
              ]
            })
          }),
          React.createElement(Divider),
          React.createElement(FieldSet, {
            label: 'Behavior',
            children: React.createElement(SettingsStack, {
              gap: 16,
              children: [
                React.createElement(Slider, {
                  label: 'Message Count Limit',
                  description: 'Sets the maximum amount of messages to fetch and display in the preview.',
                  initialValue: plugin.settings.appearance.messagesCount,
                  onValueChange: value => {
                    plugin.settings.appearance.messagesCount = value
                    onUpdate()
                  },
                  defaultValue: plugin.defaultSettings.appearance.messagesCount,
                  minValue: 10,
                  maxValue: 100,
                  markers: [...Array(10).keys()].map(n => (n + 1) * 10),
                  stickToMarkers: true
                }),
                React.createElement(NativeSwitch, {
                  label: 'Show typing users',
                  description: 'Shows who\'s typing in the previewed channel.',
                  checked: plugin.settings.appearance.typingUsers,
                  onChange: value => {
                    plugin.settings.appearance.typingUsers = value
                    onUpdate()
                  }
                }),
                React.createElement(RadioGroup, {
                  label: 'Scrolling',
                  options: [
                    {
                      name: 'Scroll',
                      value: 'default',
                      desc: 'Redirect scroll to the preview while it is open.'
                    },
                    {
                      name: 'Shift + Scroll',
                      value: 'shift',
                      desc: 'Redirect scroll to the preview only while holding Shift.'
                    }
                  ],
                  value: plugin.settings.behaviour.scroll,
                  onChange: ({ value }) => {
                    plugin.settings.behaviour.scroll = value
                    onUpdate()
                  }
                }),
                React.createElement(RadioGroup, {
                  label: 'NSFW',
                  options: [
                    {
                      name: 'Show',
                      value: 'show',
                      desc: 'Enable the preview for NSFW channels.'
                    },
                    {
                      name: 'Obscure media',
                      value: 'obscure',
                      desc: 'Blur all images and videos in the preview of NSFW channels.'
                    },
                    {
                      name: 'Don\'t show',
                      value: 'hide',
                      desc: 'Disable the preview for NSFW channels.'
                    }
                  ],
                  value: plugin.settings.behaviour.nsfw,
                  onChange: ({ value }) => {
                    plugin.settings.behaviour.nsfw = value
                    onUpdate()
                  }
                })
              ]
            })
          }),
          React.createElement(Divider),
          React.createElement(FieldSet, {
            label: 'Appearance',
            children: React.createElement(SettingsStack, {
              gap: 16,
              children: [
                React.createElement(Slider, {
                  label: 'Preview Height',
                  description: 'Sets the height of the preview window relative to the Discord window.',
                  initialValue: plugin.settings.appearance.popoutHeight,
                  onValueChange: value => {
                    plugin.settings.appearance.popoutHeight = value
                    onUpdate()
                  },
                  defaultValue: plugin.defaultSettings.appearance.popoutHeight,
                  minValue: 10,
                  maxValue: 90,
                  markers: [...Array(18).keys()].map(n => (n + 1) * 5).slice(1),
                  stickToMarkers: true,
                  onMarkerRender: m => m % 10 === 0 ? m + '%' : ''
                }),
                React.createElement(RadioGroup, {
                  label: 'Message Display',
                  options: [
                    { name: 'Cozy', value: 'cozy' },
                    { name: 'Compact', value: 'compact' }
                  ],
                  value: plugin.settings.appearance.displayMode,
                  onChange: ({ value }) => {
                    plugin.settings.appearance.displayMode = value
                    onUpdate()
                  }
                }),
                React.createElement(Field, {
                  label: 'Space between Message Groups',
                  children: React.createElement(SettingsStack, {
                    children: [
                      React.createElement(Checkbox, {
                        value: plugin.settings.appearance.groupSpacingSync,
                        onChange: (_, value) => {
                          plugin.settings.appearance.groupSpacingSync = value
                          onUpdate()
                        },
                        children: 'Sync with app settings'
                      }),
                      !plugin.settings.appearance.groupSpacingSync && (
                        React.createElement(Slider, {
                          initialValue: plugin.settings.appearance.groupSpacing,
                          onValueChange: value => {
                            plugin.settings.appearance.groupSpacing = value
                            onUpdate()
                          },
                          defaultValue: plugin.defaultSettings.appearance.groupSpacing,
                          minValue: 0,
                          maxValue: 24,
                          markers: [0, 4, 8, 16, 24],
                          stickToMarkers: true,
                          onMarkerRender: m => m + 'px'
                        })
                      )
                    ]
                  })
                }),
                React.createElement(Divider),
                React.createElement(NativeSwitch, {
                  label: 'Backdrop',
                  description: 'Darken the chat behind the preview for better contrast.',
                  checked: plugin.settings.appearance.darkenChat,
                  onChange: value => {
                    plugin.settings.appearance.darkenChat = value
                    onUpdate()
                  }
                }),
                plugin.settings.appearance.darkenChat && (
                  React.createElement(Slider, {
                    label: 'Dimming Level',
                    initialValue: plugin.settings.appearance.darkenLevel,
                    onValueChange: value => {
                      plugin.settings.appearance.darkenLevel = value
                      onUpdate()
                    },
                    defaultValue: plugin.defaultSettings.appearance.darkenLevel,
                    minValue: .1,
                    maxValue: 1,
                    markers: [...Array(10).keys()].map(n => (n + 1) / 10),
                    stickToMarkers: true,
                    onMarkerRender: m => (m * 100) + '%'
                  })
                ),
                React.createElement('button', {
                  type: 'button',
                  onClick: forceUpdate
                }, 'Refresh'),
                React.createElement('pre', {
                  id: 'ChannelsPreview-diagnostic-text',
                  style: { whiteSpace: 'pre-wrap' }
                }, buildDiagnosticReport())
              ]
            })
          })
        ]
      })
    }

    return React.createElement(SettingsPanelBoundary, {
      children: React.createElement(SettingsPanel)
    })
  }
}
