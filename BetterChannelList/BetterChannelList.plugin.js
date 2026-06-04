/**
 * @name BetterChannelList
 * @author arg0NNY
 * @authorLink https://github.com/okdevme/DiscordPlugins
 * @invite M8DBtcZjXD
 * @donate https://donationalerts.com/r/arg0nny
 * @version 1.2.17
 * @description 2 in 1: Shows the most recent message for each channel and brings channel list redesign from the new mobile UI.
 * @website https://github.com/okdevme/DiscordPlugins/tree/master/BetterChannelList
 * @source https://github.com/okdevme/DiscordPlugins/blob/master/BetterChannelList/BetterChannelList.plugin.js
 * @runAt idle
 */

/* ### CONFIG START ### */
const config = {
  info: {
    name: 'BetterChannelList',
    version: '1.2.17',
    description: '2 in 1: Shows the most recent message for each channel and brings channel list redesign from the new mobile UI.'
  },
  changelog: [
    {
      type: 'fixed',
      title: 'Fixes',
      items: [
        'Updated author GitHub username.'
      ]
    }
  ]
}
/* ### CONFIG END ### */

const {
  Webpack,
  DOM,
  ContextMenu,
  Patcher,
  UI,
  Logger,
  React,
  Utils,
  Components
} = new BdApi(config.info.name)

const { Filters } = Webpack
const { ErrorBoundary } = Components

const Dispatcher = Webpack.getModule(Filters.byKeys('dispatch', 'subscribe'), { searchExports: true })
const ChannelStore = Webpack.getStore('ChannelStore')
const GuildChannelStore = Webpack.getStore('GuildChannelStore')
const UserStore = Webpack.getStore('UserStore')
const SelectedGuildStore = Webpack.getStore('SelectedGuildStore')
const RelationshipStore = Webpack.getStore('RelationshipStore')
const MessageStore = Webpack.getStore('MessageStore')
const Flux = Webpack.getByKeys('Store', 'connectStores')

const findInReactTree = (tree, searchFilter) => Utils.findInTree(tree, searchFilter, { walkable: ['props', 'children', 'child', 'sibling'] })

const Data = new Proxy({}, {
  get (_, k) {
    return BdApi.Data.load(config.info.name, k)
  },
  set (_, k, v) {
    BdApi.Data.save(config.info.name, k, v)
    return true
  }
})

const EmojiIconSizes = {
  TINY: 'tiny',
  SMALL: 'small',
  MEDIUM: 'medium'
}

const Button = Webpack.getModule(Filters.byStrings('button', 'hasText', 'expressiveWrapper'), { searchExports: true })
const Text = Webpack.getModule(m => Filters.byStrings('WebkitLineClamp', 'data-text-variant')(m?.render), { searchExports: true })
const Popout = Webpack.getModule(m => Filters.byKeys('Animation')(m) && Filters.byStrings('renderPopout')(m?.prototype?.render), { searchExports: true })
const Switch = Webpack.getModule(Filters.byStrings('checkbox', 'animated.rect'), { searchExports: true })
const { RadioGroup } = Webpack.getMangled(Filters.bySource('"radiogroup"', 'getFocusableElements'), {
  RadioGroup: Filters.byStrings('label', 'description')
})
const Stack = Webpack.getModule(m => Filters.byStrings('data-direction', 'data-justify')(m?.render), { searchExports: true })
const Divider = Webpack.getModule(Filters.byStrings('),style:{marginTop:'), { searchExports: true })
const Field = Webpack.getModule(Filters.byStrings('helperTextId', 'errorMessage'), { searchExports: true })

const { getSocket } = Webpack.getByKeys('getSocket')
const ChannelItemParent = [...Webpack.getWithKey(Filters.byStrings('shouldIndicateNewChannel', 'MANAGE_CHANNELS'), {
  target: Webpack.getModule(Filters.bySource('shouldIndicateNewChannel', 'MANAGE_CHANNELS'), { raw: true })?.declarations
})]
const ChannelItem = [...Webpack.getWithKey(Filters.byStrings('hasActiveThreads', 'isGuildVocal'))]
const ChannelItemIcon = Webpack.getModule(m => Filters.byStrings('role:"img"', 'icon`')(m?.type), { searchExports: true })
const ChannelTypes = Webpack.getModule(Filters.byKeys('GUILD_TEXT'), { searchExports: true })
const MessageTypes = Webpack.getModule(Filters.byKeys('REPLY', 'USER_JOIN'), { searchExports: true })
const { intl, t } = Webpack.getByKeys('intl', 't')
const useStateFromStores = Webpack.getModule(Filters.byStrings('useStateFromStores'), { searchExports: true })
const MessageAuthor = Webpack.getByStrings('isRepliedMessage', 'userOverride', 'decorations')
const buildMessageReplyContent = Webpack.getModule(Filters.byStrings('trailingIconClass', 'CHANNEL_PINNED_MESSAGE'), { searchExports: true })
const ListNavigatorProvider = [...Webpack.getWithKey(Filters.byStrings('containerProps', 'tabIndex', 'Provider', 'orientation'))]
const Emoji = Webpack.getModule(Filters.byStrings('emojiId', 'emojiName', 'animated', 'shouldAnimate'), { searchExports: true })
const ThemeStore = Webpack.getStore('ThemeStore')
const ColorUtils = {
  hexWithOpacity (color, opacity) {
    const _opacity = Math.round(Math.min(Math.max(opacity ?? 1, 0), 1) * 255)
    return color + _opacity.toString(16).toUpperCase()
  }
}
const SortedVoiceStateStore = Webpack.getStore('SortedVoiceStateStore')
const isLimited = Webpack.getByStrings('permissionOverwrites', 'VIEW_CHANNEL', 'CONNECT')
const ActiveThreadsStore = Webpack.getStore('ActiveThreadsStore')
const DevToolsDesignTogglesStore = Webpack.getStore('DevToolsDesignTogglesStore')
const EmojiPicker = Webpack.getModule(m => Filters.byStrings('pickerIntention')(m?.type?.render))
const EmojiPickerIntentions = Webpack.getModule(Filters.byKeys('GUILD_STICKER_RELATED_EMOJI', 'SOUNDBOARD'), { searchExports: true })
const { Alert, AlertTypes } = Webpack.getMangled(Filters.bySource('messageType', '"warn"'), {
  Alert: Filters.byStrings('messageType'),
  AlertTypes: Filters.byKeys('WARNING', 'ERROR')
})
const ReplyMessageHeader = Webpack.getModule(Filters.bySource('replyReference', 'isReplySpineClickable', 'showReplySpine'), {
  declarationFilter: m => Filters.byStrings('referencedMessage', 'USER_JOIN')(m?.type)
})?.type
const createMessage = Webpack.getByStrings('createMessage: author cannot be undefined')

const Selectors = {
  ChannelItem: Webpack.getByKeys('unread', 'link'),
  Message: Webpack.getByKeys('repliedTextPreview', 'repliedTextContent'),
  App: Webpack.getByKeys('app', 'layers'),
  Base: Webpack.getByKeys('base', 'sidebar'),
  DirectMessages: Webpack.getByKeys('dm', 'channel'),
  GuildHeader: Webpack.getByKeys('bannerImage', 'bannerImg'),
  SidebarFooter: Webpack.getByKeys('nameTag', 'avatarWrapper'),
  Diversity: Webpack.getByKeys('diversitySelectorOptions'),
}

function deepEqual (x, y) {
  const ok = Object.keys, tx = typeof x, ty = typeof y
  return x && y && tx === 'object' && tx === ty ? (
    ok(x).length === ok(y).length &&
    ok(x).every(key => deepEqual(x[key], y[key]))
  ) : (x === y)
}

function forceAppUpdate (reason = null) {
  Dispatcher.dispatch({ type: 'DOMAIN_MIGRATION_START' })
  requestIdleCallback(() => Dispatcher.dispatch({ type: 'DOMAIN_MIGRATION_SKIP' }))

  Logger.log(`Forced app update.` + (reason ? ` Reason: ${reason}` : ''))
}

function requestLastMessages (guildId, channelIds = null) {
  if (guildId === null) return

  channelIds = channelIds ?? GuildChannelStore.getSelectableChannelIds(guildId)

  getSocket().requestLastMessages(
    guildId,
    channelIds ?? GuildChannelStore.getSelectableChannelIds(guildId)
  )
  Logger.log(`Requested last messages for guild ${guildId} channels:`, channelIds)
}

let selectedGuildId = null

function handleChannelSelect ({ guildId }) {
  if (selectedGuildId !== guildId)
    requestLastMessages(
      guildId,
      GuildChannelStore.getSelectableChannelIds(guildId)
    )

  selectedGuildId = guildId
}

function handleChannelUpdates ({ channels }) {
  if (channels.some(c => c.guild_id === selectedGuildId))
    requestLastMessages(selectedGuildId)
}

function handleGuildMemberUpdate ({ guildId, user }) {
  if (user.id === UserStore.getCurrentUser().id && guildId === selectedGuildId)
    requestLastMessages(guildId)
}

function updateGuildIfCurrent ({ guildId }) {
  if (guildId === selectedGuildId)
    requestLastMessages(guildId)
}

function updateChannel ({ channelId }) {
  const guildId = ChannelStore.getChannel(channelId)?.guild_id
  if (guildId === selectedGuildId)
    requestLastMessages(
      guildId,
      [channelId]
    )
}

function handleMessagePreviewsLoaded ({ messages }) {
  for (const message of messages) {
    if (MessageStore.getMessage(message.channel_id, message.id))
      continue

    Dispatcher.dispatch({
      type: 'LOAD_MESSAGES_SUCCESS',
      channelId: message.channel_id,
      hasMoreAfter: false,
      hasMoreBefore: true,
      isAfter: true,
      isBefore: false,
      isStale: true,
      limit: 1,
      messages: [message]
    })
  }
}

const DispatcherSubscriptions = {
  CHANNEL_SELECT: handleChannelSelect,
  MESSAGE_DELETE: updateChannel,
  CHANNEL_UPDATES: handleChannelUpdates,
  GUILD_MEMBER_UPDATE: handleGuildMemberUpdate,
  GUILD_ROLE_CREATE: updateGuildIfCurrent,
  GUILD_ROLE_UPDATE: updateGuildIfCurrent,
  GUILD_ROLE_DELETE: updateGuildIfCurrent,
  IMPERSONATE_UPDATE: updateGuildIfCurrent,
  IMPERSONATE_STOP: updateGuildIfCurrent,
  TRUNCATE_MESSAGES: updateChannel,
  MESSAGE_PREVIEWS_LOADED: handleMessagePreviewsLoaded
}

const OpenedEmojiPickerStore = (() => {
  let currentChannelId = null

  function handleEmojiPickerOpen ({ channelId }) {
    currentChannelId = channelId
  }

  function handleEmojiPickerClose () {
    currentChannelId = null
  }

  return new class OpenedEmojiPickerStore extends Flux.Store {
    getChannelId () {
      return currentChannelId
    }
  }(Dispatcher, {
    'BCL__EMOJI_PICKER_OPEN': handleEmojiPickerOpen,
    'BCL__EMOJI_PICKER_CLOSE': handleEmojiPickerClose
  })
})()

const ChannelEmojiIconStore = (() => {
  const DATA_KEY = 'emojiIconOverrides'
  let emojis = {}

  function saveData () {
    Data[DATA_KEY] = emojis
  }

  function handleEmojiIconSet ({ channelId, emoji }) {
    emojis[channelId] = emoji
    saveData()
  }

  function handleEmojiIconDelete ({ channelId }) {
    delete emojis[channelId]
    saveData()
  }

  function handleEmojiIconReset () {
    emojis = {}
    saveData()
  }

  return new class ChannelEmojiIconStore extends Flux.Store {
    initialize () {
      emojis = Data[DATA_KEY] ?? {}
    }

    getEmoji (channelId) {
      return emojis[channelId]
    }

    hasAnyEmoji () {
      return Object.keys(emojis).length > 0
    }
  }(Dispatcher, {
    'BCL__EMOJI_ICON_SET': handleEmojiIconSet,
    'BCL__EMOJI_ICON_DELETE': handleEmojiIconDelete,
    'BCL__EMOJI_ICON_RESET': handleEmojiIconReset
  })
})()

function buildLastMessageContent (channel, message) {
  const data = ReplyMessageHeader({
    baseMessage: message ?? createMessage({ channelId: '1337', content: 'Placeholder message' }),
    referencedMessage: {
      state: 0,
      message
    },
    channel
  })

  return message ? data.props.content : null
}

function ChannelLastMessage ({ channel, unread, muted, noColor }) {
  const message = useStateFromStores([MessageStore], () => MessageStore.getMessages(channel.id)?.last())
  const author = useStateFromStores([UserStore], () => message?.author && UserStore.getUser(message.author.id))

  const isAuthorBlocked = useStateFromStores([RelationshipStore], () => author && RelationshipStore.isBlocked(author.id))
  const isAuthorIgnored = useStateFromStores([RelationshipStore], () => author && RelationshipStore.isIgnored(author.id))

  const messageContent = buildLastMessageContent(channel, message)

  if (!message) return null

  const { contentPlaceholder, leadingIcon, trailingIcon, renderedContent } = buildMessageReplyContent(
    message,
    messageContent,
    isAuthorBlocked,
    isAuthorIgnored,
    `${Selectors.Message.repliedTextContent}`,
    {
      leadingIconClass: Selectors.Message.repliedTextContentLeadingIcon,
      trailingIconClass: Selectors.Message.repliedTextContentTrailingIcon,
      iconSize: 16
    }
  )

  const color = unread ? 'text-default' : 'text-muted'
  const style = { '--custom-message-content-color': `var(--${color})` }

  let content
  if (isAuthorBlocked) {
    content = React.createElement(
      Text,
      {
        className: Selectors.Message.repliedTextPlaceholder,
        variant: 'text-sm/medium',
        color: 'text-muted',
        children: intl.format(t['+FcYM/'], { count: 1 }) // LocaleStore.Messages.BLOCKED_MESSAGES.format({ count: 1 })
      }
    )
  } else {
    content = renderedContent
      ? React.createElement(
        Text,
        {
          color,
          style,
          className: Selectors.Message.repliedTextPreview,
          children: renderedContent
        }
      )
      : React.createElement(
        Text,
        {
          tag: 'span',
          variant: 'text-sm/medium',
          color,
          style,
          className: `${Selectors.Message.repliedTextPreview} ${Selectors.Message.repliedTextPlaceholder}`,
          children: contentPlaceholder
        }
      )
  }

  return React.createElement(
    Text,
    {
      className: Utils.className({
        [Selectors.Message.repliedMessage]: true,
        'BCL--last-message': true,
        'BCL--last-message--muted': muted,
        'BCL--last-message--no-color': noColor,
        'BCL--last-message--unread': unread,
      }),
      variant: 'text-sm/semibold',
      color
    },
    [
      !isAuthorBlocked
      && !['USER_JOIN', 'ROLE_SUBSCRIPTION_PURCHASE', 'GUILD_APPLICATION_PREMIUM_SUBSCRIPTION', 'GUILD_DEADCHAT_REVIVE_PROMPT', 'GUILD_GAMING_STATS_PROMPT']
        .some(t => message.type === MessageTypes[t])
      && React.createElement(
        MessageAuthor,
        {
          message,
          channel: channel,
          compact: true,
          hideGuildTag: true,
          hideSystemTag: true,
          className: 'BCL--last-message-author'
        }
      ),
      [leadingIcon, content, trailingIcon]
    ]
  )
}

function useChannelEmoji (channel) {
  const override = useStateFromStores([ChannelEmojiIconStore], () => ChannelEmojiIconStore.getEmoji(channel.id))
  const name = override ?? channel.iconEmoji?.name ?? '🌐'
  const theme = useStateFromStores([ThemeStore], () => ThemeStore.theme)

  return {
    color: ColorUtils.hexWithOpacity(
      BCL__emojiColors[name] ?? '#607D8B',
      theme === 'dark' ? .2 : .16
    ),
    emojiName: name,
    emojiId: !override ? channel.iconEmoji?.id : undefined
  }
}

function ChannelEmojiIcon ({ channel, size = EmojiIconSizes.MEDIUM }) {
  const { color, emojiName, emojiId } = useChannelEmoji(channel)

  return React.createElement(
    'div',
    {
      className: `BCL--channel-icon BCL--channel-icon--${size}`,
      style: { '--bcl-channel-icon-bg': color }
    },
    React.createElement(
      Emoji,
      { emojiId, emojiName, animated: false }
    )
  )
}

function ChannelVoiceIcon () {
  return React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '14px',
      height: '14px',
      viewBox: '0 0 24 24',
      className: 'BCL--channel-name-icon'
    },
    React.createElement(
      'path',
      {
        fill: 'currentColor',
        d: 'M11.383 3.07904C11.009 2.92504 10.579 3.01004 10.293 3.29604L6 8.00204H3C2.45 8.00204 2 8.45304 2 9.00204V15.002C2 15.552 2.45 16.002 3 16.002H6L10.293 20.71C10.579 20.996 11.009 21.082 11.383 20.927C11.757 20.772 12 20.407 12 20.002V4.00204C12 3.59904 11.757 3.23204 11.383 3.07904ZM14 5.00195V7.00195C16.757 7.00195 19 9.24595 19 12.002C19 14.759 16.757 17.002 14 17.002V19.002C17.86 19.002 21 15.863 21 12.002C21 8.14295 17.86 5.00195 14 5.00195ZM14 9.00195C15.654 9.00195 17 10.349 17 12.002C17 13.657 15.654 15.002 14 15.002V13.002C14.551 13.002 15 12.553 15 12.002C15 11.451 14.551 11.002 14 11.002V9.00195Z'
      }
    )
  )
}

function ChannelStageIcon () {
  return React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '14px',
      height: '14px',
      viewBox: '0 0 24 24',
      className: 'BCL--channel-name-icon'
    },
    React.createElement(
      'path',
      {
        fill: 'currentColor',
        d: 'M14 13C14 14.1 13.1 15 12 15C10.9 15 10 14.1 10 13C10 11.9 10.9 11 12 11C13.1 11 14 11.9 14 13ZM8.5 20V19.5C8.5 17.8 9.94 16.5 12 16.5C14.06 16.5 15.5 17.8 15.5 19.5V20H8.5ZM7 13C7 10.24 9.24 8 12 8C14.76 8 17 10.24 17 13C17 13.91 16.74 14.75 16.31 15.49L17.62 16.25C18.17 15.29 18.5 14.19 18.5 13C18.5 9.42 15.58 6.5 12 6.5C8.42 6.5 5.5 9.42 5.5 13C5.5 14.18 5.82 15.29 6.38 16.25L7.69 15.49C7.26 14.75 7 13.91 7 13ZM2.5 13C2.5 7.75 6.75 3.5 12 3.5C17.25 3.5 21.5 7.75 21.5 13C21.5 14.73 21.03 16.35 20.22 17.75L21.51 18.5C22.45 16.88 23 15 23 13C23 6.93 18.07 2 12 2C5.93 2 1 6.93 1 13C1 15 1.55 16.88 2.48 18.49L3.77 17.74C2.97 16.35 2.5 14.73 2.5 13Z'
      }
    )
  )
}

function ChannelLockedIcon () {
  return React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '14px',
      height: '14px',
      viewBox: '0 0 24 24',
      className: 'BCL--channel-name-icon'
    },
    React.createElement(
      'path',
      {
        fill: 'currentColor',
        d: 'M17 11V7C17 4.243 14.756 2 12 2C9.242 2 7 4.243 7 7V11C5.897 11 5 11.896 5 13V20C5 21.103 5.897 22 7 22H17C18.103 22 19 21.103 19 20V13C19 11.896 18.103 11 17 11ZM12 18C11.172 18 10.5 17.328 10.5 16.5C10.5 15.672 11.172 15 12 15C12.828 15 13.5 15.672 13.5 16.5C13.5 17.328 12.828 18 12 18ZM15 11H9V7C9 5.346 10.346 4 12 4C13.654 4 15 5.346 15 7V11Z'
      }
    )
  )
}

function ChannelIcon ({ channel, locked }) {
  if (locked) return React.createElement(ChannelLockedIcon)
  if (channel.isGuildStageVoice()) return React.createElement(ChannelStageIcon)
  if (channel.isGuildVoice()) return React.createElement(ChannelVoiceIcon)
  return React.createElement(ChannelItemIcon, { channel, locked })
}

function ChannelVoiceBadge ({ channel, locked, connected, selected }) {
  const voiceStates = useStateFromStores([SortedVoiceStateStore], () => SortedVoiceStateStore.getVoiceStatesForChannel(channel))
  const formatCount = n => n.toString().padStart(2, '0')

  const hasUserLimit = channel.userLimit > 0 && channel.userLimit !== 10000

  if (connected && selected) return null
  return React.createElement(
    'div',
    { className: 'BCL--voice-badge' + (locked ? ' BCL--voice-badge--locked' : '') },
    [
      React.createElement(ChannelIcon, { channel, locked }),
      hasUserLimit && !locked && React.createElement('span', { children: `${formatCount(voiceStates.length)}/${formatCount(channel.userLimit)}` })
    ]
  )
}

function ChannelLimitedIcon () {
  return React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '14px',
      height: '14px',
      viewBox: '0 0 256 256',
      className: 'BCL--channel-name-icon'
    },
    React.createElement(
      'path',
      {
        fill: 'currentColor',
        d: 'M208 80h-32V56a48 48 0 0 0-96 0v24H48a16 16 0 0 0-16 16v112a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V96a16 16 0 0 0-16-16Zm-72 78.63V184a8 8 0 0 1-16 0v-25.37a24 24 0 1 1 16 0ZM160 80H96V56a32 32 0 0 1 64 0Z'
      }
    )
  )
}

function ChannelNsfwIcon () {
  return React.createElement(
    'svg',
    {
      xmlns: 'http://www.w3.org/2000/svg',
      width: '14px',
      height: '14px',
      viewBox: '0 0 256 256',
      className: 'BCL--channel-name-icon'
    },
    React.createElement(
      'path',
      {
        fill: 'currentColor',
        d: 'M236.8 188.09L149.35 36.22a24.76 24.76 0 0 0-42.7 0L19.2 188.09a23.51 23.51 0 0 0 0 23.72A24.35 24.35 0 0 0 40.55 224h174.9a24.35 24.35 0 0 0 21.33-12.19a23.51 23.51 0 0 0 .02-23.72ZM120 104a8 8 0 0 1 16 0v40a8 8 0 0 1-16 0Zm8 88a12 12 0 1 1 12-12a12 12 0 0 1-12 12Z'
      }
    )
  )
}

function ChannelNameIcons ({ channel, locked }) {
  return React.createElement(
    React.Fragment, {},
    [
      !locked && isLimited(channel) && React.createElement(ChannelLimitedIcon),
      channel.isNSFW() && React.createElement(ChannelNsfwIcon)
    ]
  )
}

function getActiveThreadsCount (channel) {
  if (channel.type !== ChannelTypes.GUILD_FORUM) throw new Error('Channel is not a forum')
  return Object.keys(
    ActiveThreadsStore.getThreadsForParent(channel.guild_id, channel.id)
  ).length
}
function useActiveThreadsCount (channel) {
  return useStateFromStores([ActiveThreadsStore], () => getActiveThreadsCount(channel))
}

function ForumActivePostsCount ({ channel, unread }) {
  const count = useActiveThreadsCount(channel)

  return count > 0 ? React.createElement(
    Text,
    {
      className: `BCL--last-message`,
      variant: 'text-sm/medium',
      color: unread ? 'text-default' : 'text-muted'
    },
    intl.format(t['z0qML2'], { count }) // LocaleStore.Messages.ACTIVE_FORUM_POST_COUNT.format({ count })
  ) : null
}

const byClassName = c => m => m?.props?.className?.includes(c)

module.exports = class BetterChannelList {
  start () {
    this.injectStyle()

    selectedGuildId = SelectedGuildStore.getGuildId()
    requestLastMessages(selectedGuildId)

    Object.entries(DispatcherSubscriptions)
      .forEach(s => Dispatcher.subscribe(...s))

    this.enableDiscordInternalEmojiIconModules()
    this.patchContextMenu()
    this.patchChannelItem()
    this.patchScrollerProvider()

    forceAppUpdate('Plugin enabled')
  }

  enableDiscordInternalEmojiIconModules () {
    Patcher.after(DevToolsDesignTogglesStore, 'get', (self, [type]) => {
      if (type === 'enable_channel_emojis') return true
    })
  }

  get styleName () {
    return config.info.name + '-style'
  }

  injectStyle () {
    //language=CSS
    DOM.addStyle(this.styleName, `
        .BCL--last-message {
            pointer-events: none;
            contain: layout;
            align-items: center;
            display: flex;
            max-height: 18px;
            overflow: hidden;
        }

        .BCL--last-message-author {
            font-size: inherit !important;
            opacity: .85;
            color: inherit;
        }
        
        .BCL--last-message.BCL--last-message--no-color .BCL--last-message-author {
            color: var(--text-muted) !important;
            text-decoration-color: unset !important;
            background: unset !important;
            -webkit-text-fill-color: unset !important;
        }

        .BCL--last-message.BCL--last-message--no-color.BCL--last-message--unread .BCL--last-message-author {
            color: var(--text-strong) !important;
        }

        .BCL--last-message * {
            font-weight: 500 !important;
        }

        .${Selectors.ChannelItem.wrapper}.${Selectors.ChannelItem.modeMuted}:not(:hover) :is(.BCL--last-message, .BCL--last-message *) {
            color: var(--interactive-muted) !important;
        }

        .BCL--channel-wrapper {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 8px;
        }

        .BCL--channel-info {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-width: 0;
        }

        .BCL--channel-icon {
            --bcl-icon-size: 42px;
            --bcl-emoji-size: 20px;
            --bcl-icon-size-offset: 0px;
            --bcl-emoji-size-offset: 0px;
            flex-shrink: 0;
            width: calc(var(--bcl-icon-size) + var(--bcl-icon-size-offset));
            height: calc(var(--bcl-icon-size) + var(--bcl-icon-size-offset));
            border-radius: 50%;
            background-color: var(--bcl-channel-icon-bg, var(--background-tertiary));
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .BCL--channel-icon .emoji {
            width: calc(var(--bcl-emoji-size) + var(--bcl-emoji-size-offset));
            height: calc(var(--bcl-emoji-size) + var(--bcl-emoji-size-offset));
        }

        .BCL--channel-icon--${EmojiIconSizes.SMALL} {
            --bcl-icon-size: 32px;
            --bcl-emoji-size: 16px;
        }

        .BCL--channel-icon--${EmojiIconSizes.TINY} {
            --bcl-icon-size: 20px;
            --bcl-emoji-size: 14px;
            padding: 4px;
            margin: -4px 0;
        }
        
        .density-compact .BCL--channel-icon {
            --bcl-icon-size-offset: -4px;
            --bcl-emoji-size-offset: -2px;
        }
        
        .density-cozy .BCL--channel-icon {
            --bcl-icon-size-offset: 4px;
            --bcl-emoji-size-offset: 2px;
        }

        .${Selectors.ChannelItem.wrapper}.${Selectors.ChannelItem.modeMuted}:not(:hover) .BCL--channel-icon {
            opacity: .3;
        }

        .BCL--channel-info .${Selectors.ChannelItem.linkTop} > .${Selectors.ChannelItem.iconContainer} {
            display: none;
        }

        .BCL--channel-info .${Selectors.ChannelItem.linkBottom} {
            margin-left: 0;
        }

        .BCL--voice-badge {
            background: var(--background-secondary-alt);
            color: var(--text-default);
            padding: 5px 8px;
            border-radius: 100px;
            display: flex;
            align-items: center;
            gap: 5px;
            font-size: 12px;
            font-weight: 500;
            margin: -5px 0 -5px 4px;
            font-family: var(--font-code);
        }

        .BCL--voice-badge .${Selectors.ChannelItem.iconContainer} {
            margin-right: 0 !important;
        }

        .BCL--voice-badge svg {
            width: 14px;
            height: 14px;
            color: inherit !important;
        }

        .${Selectors.ChannelItem.wrapper}:is(:hover, :focus, :focus-within) .BCL--voice-badge:not(.BCL--voice-badge--locked) {
            display: none;
        }

        .BCL--channel-info .${Selectors.ChannelItem.name} {
            display: flex;
            align-items: center;
            gap: 3px;
        }

        .BCL--channel-info .${Selectors.ChannelItem.name} > span {
            overflow: hidden;
            text-overflow: ellipsis;
            min-width: 0;
        }

        .BCL--channel-name-icon {
            flex-shrink: 0;
            color: var(--channels-default);
        }

        .${Selectors.ChannelItem.wrapper}.${Selectors.ChannelItem.modeMuted}:not(:hover) .BCL--channel-name-icon {
            color: var(--interactive-muted);
        }

        .BCL--emoji-picker-header {
            display: flex;
            align-items: stretch;
            flex-direction: column;
            gap: 12px;
        }

        .BCL--emoji-picker-header-content {
            display: flex;
            align-items: center;
        }

        .BCL--emoji-picker + * {
            top: 119px !important;
        }

        .BCL--disabled {
            opacity: .6
        }

        /* Discord's style fixes */
        /* ===================== */

        .${Selectors.Base.sidebar}.${Selectors.Base.hidden} {
            display: none;
        }
    `)
  }

  patchContextMenu () {
    this.contextMenuPatches = [
      ContextMenu.patch('channel-context', (self, { channel }) => {
        if (!this.settings.redesign.enabled) return

        const isOverride = !!ChannelEmojiIconStore.getEmoji(channel.id)
        const onEdit = () => Dispatcher.dispatch({ type: 'BCL__EMOJI_PICKER_OPEN', channelId: channel.id })

        self.props.children.push(ContextMenu.buildMenuChildren([
          {
            type: 'group',
            items: [{
              type: isOverride ? 'submenu' : 'text',
              label: isOverride ? 'Emoji Icon' : 'Edit Emoji Icon',
              action: onEdit,
              items: [
                {
                  label: 'Edit',
                  action: onEdit
                },
                {
                  label: 'Reset',
                  action: () => Dispatcher.dispatch({ type: 'BCL__EMOJI_ICON_DELETE', channelId: channel.id })
                }
              ]
            }]
          }
        ]))
      })
    ]
  }

  willRenderLastMessage (channel) {
    if (!channel) return false
    if (channel.type === ChannelTypes.GUILD_FORUM)
      return this.settings.redesign.enabled && this.settings.redesign.iconSize === EmojiIconSizes.MEDIUM && getActiveThreadsCount(channel) > 0
    if ([ChannelTypes.GUILD_TEXT, ChannelTypes.GUILD_ANNOUNCEMENT].includes(channel.type))
      return this.settings.lastMessage.enabled && !!MessageStore.getMessages(channel.id)?.last()
    return false
  }

  patchChannelItem () {
    function useEmojiPickerState (channel) {
      const openedEmojiPickerChannelId = useStateFromStores([OpenedEmojiPickerStore], () => OpenedEmojiPickerStore.getChannelId())
      const isEmojiPickerOpen = openedEmojiPickerChannelId === channel.id

      return {
        openedEmojiPickerChannelId,
        isEmojiPickerOpen
      }
    }

    let isPatched = false
    Patcher.after(...ChannelItemParent, (self, [{ channel }], value) => {
      const { isEmojiPickerOpen } = useEmojiPickerState(channel)
      value.props.forceClosePopout = isEmojiPickerOpen

      if (isPatched) return
      isPatched = true

      Patcher.after(value.type.DecoratedComponent.prototype, 'render', ({ props }, args, value) => {
        if (props.forceClosePopout) {
          const popout = findInReactTree(value, m => m?.renderPopout)
          if (popout) popout.shouldShow = false
        }
      })
    })

    Patcher.instead(...ChannelItem, (self, [props, ...args], original) => {
      const { channel, guild, muted: _muted, selected: _selected, unread, locked, connected } = props

      const elementRef = React.useRef(null)
      const { openedEmojiPickerChannelId, isEmojiPickerOpen } = useEmojiPickerState(channel)

      const muted = openedEmojiPickerChannelId ? !isEmojiPickerOpen : _muted
      const selected = openedEmojiPickerChannelId ? isEmojiPickerOpen : _selected

      const value = original({ ...props, muted, selected }, ...args)

      const link = findInReactTree(value, byClassName(Selectors.ChannelItem.link))
      if (!link) return value

      const { children } = link.props

      // Inject last message
      if (this.settings.lastMessage.enabled && [ChannelTypes.GUILD_TEXT, ChannelTypes.GUILD_ANNOUNCEMENT].includes(channel.type))
        children.push(
          React.createElement(ErrorBoundary, {
            name: 'ChannelLastMessage',
            children: React.createElement(ChannelLastMessage, {
              channel,
              guild,
              muted,
              selected,
              unread,
              locked,
              noColor: !this.settings.lastMessage.roleColors
            })
          })
        )

      /**
       * Channel item redesign
       */
      // TODO: Add support for threads/posts
      if (!this.settings.redesign.enabled) return value

      if (this.settings.redesign.iconSize === EmojiIconSizes.MEDIUM && channel.type === ChannelTypes.GUILD_FORUM)
        children.push(
          React.createElement(ForumActivePostsCount, { channel, unread })
        )

      // Emoji icon
      link.props.className += ' BCL--channel-wrapper' + (muted ? ' BCL--channel-wrapper--muted' : '')
      link.props.children = [
        React.createElement(ChannelEmojiIcon, { channel, size: this.settings.redesign.iconSize }),
        React.createElement('div', { className: 'BCL--channel-info', children })
      ]

      // Voice channel badge
      if ([ChannelTypes.GUILD_VOICE, ChannelTypes.GUILD_STAGE_VOICE].includes(channel.type)) {
        const actions = findInReactTree(link, byClassName(Selectors.ChannelItem.children))
        if (actions)
          actions.props.children = actions.props.children
            .flatMap(c => c?.type === React.Fragment ? c.props.children : c)
            .filter(c => !findInReactTree(c, m => m?.props?.hasOwnProperty('userCount')))
            .concat([React.createElement(ChannelVoiceBadge, { channel, locked, connected, selected })])
      }

      // Channel name icons
      const name = findInReactTree(link, byClassName(Selectors.ChannelItem.name))
      if (name) {
        const { children } = name.props
        name.props.children = [
          React.createElement('span', { children }),
          React.createElement(ChannelNameIcons, { channel, locked })
        ]
      }

      // Emoji picker
      const _children = value.props.children
      const externalRef = _children.props.ref
      _children.props.ref = el => {
        elementRef.current = el
        if (typeof externalRef === 'function') externalRef(el)
        else if (typeof externalRef === 'object') externalRef.current = el
      }
      value.props.children = React.createElement(Popout, {
        targetElementRef: elementRef,
        renderPopout: ({ closePopout }) => React.createElement(EmojiPicker, {
          className: 'BCL--emoji-picker',
          headerClassName: 'BCL--emoji-picker-header',
          closePopout,
          pickerIntention: EmojiPickerIntentions.SOUNDBOARD,
          onNavigateAway: closePopout,
          onSelectEmoji: ({ emoji }) => {
            Dispatcher.dispatch({ type: 'BCL__EMOJI_ICON_SET', channelId: channel.id, emoji: emoji.surrogates })
            closePopout()
          },
          renderHeader: header => React.createElement(React.Fragment, {
            children: [
              React.createElement(Alert, {
                messageType: AlertTypes.WARNING,
                children: 'Icon changes locally. Only you will see this change.'
              }),
              React.createElement('div', {
                className: 'BCL--emoji-picker-header-content',
                children: header
              })
            ]
          })
        }),
        position: 'right',
        spacing: 16,
        shouldShow: isEmojiPickerOpen,
        onRequestClose: () => Dispatcher.dispatch({ type: 'BCL__EMOJI_PICKER_CLOSE' }),
        children: () => _children
      })
      value.props.children.children = _children // Allow other plugins to modify the children

      return value
    })
  }

  patchScrollerProvider () {
    let guildChannels
    Patcher.after(...ListNavigatorProvider, (self, props, value) => {
      if (value.props?.value?.id !== 'channels') return

      const scroller = findInReactTree(value, m => m.props?.guildChannels)
      guildChannels = scroller.props.guildChannels

      Patcher.before(scroller.type.prototype, 'render', (self, props) => {
        if (self.getRowHeight.__originalFunction) return

        Patcher.instead(self, 'getRowHeight', (self, props, original) => {
          let result = original(...props)
          if (result === 0) return result

          const [section, row] = props
          if (section > 1) {
            const { channel } = guildChannels.getChannelFromSectionRow(section, row) ?? {}
            if (!channel) return result

            const emojiIconSize = this.settings.redesign.enabled && this.settings.redesign.iconSize

            if (this.willRenderLastMessage(channel.record) || emojiIconSize === EmojiIconSizes.MEDIUM) result += 18
            else if (emojiIconSize === EmojiIconSizes.SMALL) result += 8
          }

          return result
        })
      })
    })
  }

  stop () {
    this.contextMenuPatches?.forEach(p => p())
    Patcher.unpatchAll()
    this.clearStyle()

    Object.entries(DispatcherSubscriptions)
      .forEach(s => Dispatcher.unsubscribe(...s))

    forceAppUpdate('Plugin disabled')
  }

  clearStyle () {
    DOM.removeStyle(this.styleName)
  }

  constructor () {
    this.defaultSettings = {
      lastMessage: {
        enabled: true,
        roleColors: false
      },
      redesign: {
        enabled: true,
        iconSize: EmojiIconSizes.MEDIUM
      }
    }

    this.settings = this.loadSettings(this.defaultSettings)

    this.showChangelogIfNeeded()
  }

  loadSettings (defaults = {}) {
    return Utils.extend({}, defaults, Data.settings)
  }
  saveSettings (settings = this.settings) {
    return Data.settings = settings
  }

  showChangelogIfNeeded () {
    const currentVersionInfo = Utils.extend(
      { version: config.info.version, hasShownChangelog: false },
      Data.currentVersionInfo
    )
    if (currentVersionInfo.version === config.info.version && currentVersionInfo.hasShownChangelog) return

    this.showChangelog()
    Data.currentVersionInfo = { version: config.info.version, hasShownChangelog: true }
  }
  showChangelog () {
    return UI.showChangelogModal({
      title: config.info.name,
      subtitle: 'Version ' + config.info.version,
      changes: config.changelog
    })
  }

  getSettingsPanel () {
    // TODO: Add channel preview

    const settingsSnapshot = JSON.parse(JSON.stringify(this.settings))

    const settings = this.settings
    const saveSettings = this.saveSettings.bind(this)

    function FormSwitch (props) {
      const [checked, setChecked] = React.useState(props.checked)

      return React.createElement(Switch, {
        ...props,
        checked,
        onChange: e => {
          props.onChange(e)
          setChecked(e)
          saveSettings()
        }
      })
    }

    const Settings = () => {
      const resetShown = useStateFromStores([ChannelEmojiIconStore], () => ChannelEmojiIconStore.hasAnyEmoji())
      const [_, forceUpdate] = React.useReducer(x => x + 1, 0)

      React.useEffect(() => () => {
        if (!deepEqual(settingsSnapshot, this.settings))
          setTimeout(() => forceAppUpdate('Settings changed'))
      }, [])

      return React.createElement(
        Stack,
        { gap: 24 },
        [
          React.createElement(Stack, {
            gap: 16,
            children: [
              React.createElement(FormSwitch, {
                label: 'Last message',
                description: 'Shows the most recent message for each channel in the channel list.',
                checked: settings.lastMessage.enabled,
                onChange: e => {
                  settings.lastMessage.enabled = e
                  forceUpdate()
                }
              }),
              React.createElement(FormSwitch, {
                label: 'Enable role color',
                description: 'Paints author\'s username according to color of their role.',
                checked: settings.lastMessage.roleColors,
                onChange: e => settings.lastMessage.roleColors = e,
                disabled: !settings.lastMessage.enabled
              })
            ]
          }),
          React.createElement(Divider),
          React.createElement(Stack, {
            gap: 16,
            children: [
              React.createElement(FormSwitch, {
                label: 'Redesign',
                description: 'Brings channel list redesign from the new mobile UI.',
                checked: settings.redesign.enabled,
                onChange: e => {
                  settings.redesign.enabled = e
                  forceUpdate()
                }
              }),
              React.createElement(Field, {
                label: 'Emoji Icons',
                children: React.createElement(Stack, {
                  direction: 'horizontal',
                  children: [
                    React.createElement(Alert, {
                      messageType: AlertTypes.INFO,
                      children: 'Edit the channel emoji icons using their context menu.',
                      className: !settings.redesign.enabled ? 'BCL--disabled' : null
                    }),
                    resetShown && React.createElement(Button, {
                      variant: 'critical-primary',
                      text: 'Reset All Icons',
                      onClick: () => this.openResetConfirmationModal(),
                      disabled: !settings.redesign.enabled
                    })
                  ]
                })
              }),
              React.createElement(RadioGroup, {
                label: 'Icon Size',
                description: 'Controls the size of the channel emoji icons.',
                options: [
                  { name: 'Medium', value: EmojiIconSizes.MEDIUM },
                  { name: 'Small', value: EmojiIconSizes.SMALL },
                  { name: 'Tiny', value: EmojiIconSizes.TINY }
                ],
                value: settings.redesign.iconSize,
                onChange: e => {
                  settings.redesign.iconSize = e.value
                  forceUpdate()
                  saveSettings()
                },
                disabled: !settings.redesign.enabled
              })
            ]
          })
        ]
      )
    }

    return React.createElement(Settings)
  }

  openResetConfirmationModal () {
    UI.showConfirmationModal(
      'Are you sure?',
      'All the channel emoji icons you\'ve edited will be reset to their default state. This cannot be undone.',
      {
        danger: true,
        confirmText: 'Reset',
        onConfirm: () => Dispatcher.dispatch({ type: 'BCL__EMOJI_ICON_RESET' })
      }
    )
  }
}

const BCL__emojiColors = Object.freeze({"😀":"#E67E22","😃":"#E67E22","😄":"#E67E22","😁":"#E67E22","😆":"#E67E22","😅":"#E67E22","🤣":"#F1C40F","😂":"#E67E22","🙂":"#F1C40F","🙃":"#F1C40F","🫠":"#F1C40F","😉":"#F1C40F","😊":"#F1C40F","😇":"#3498DB","🥰":"#F1C40F",
  "😍":"#E67E22","🤩":"#E67E22","😘":"#F1C40F","😗":"#F1C40F","☺️":"#607D8B","😚":"#F1C40F","😙":"#F1C40F","🥲":"#F1C40F","😋":"#F1C40F","😛":"#F1C40F","😜":"#F1C40F","🤪":"#E67E22","😝":"#F1C40F","🤑":"#F1C40F","🤗":"#E67E22","🤭":"#F1C40F","🫢":"#F1C40F","🫣":"#F1C40F","🤫":"#F1C40F","🤔":"#F1C40F","🫡":"#F1C40F","🤐":"#F1C40F","🤨":"#F1C40F","😐":"#F1C40F","😑":"#F1C40F","😶":"#F1C40F","🫥":"#F1C40F","😶‍🌫️":"#9B59B6","😏":"#F1C40F","😒":"#F1C40F","🙄":"#E67E22","😬":"#9B59B6","😮‍💨":"#F1C40F","🤥":"#F1C40F","😌":"#F1C40F","😔":"#F1C40F","😪":"#F1C40F","🤤":"#F1C40F","😴":"#F1C40F","😷":"#9B59B6","🤒":"#E67E22","🤕":"#9B59B6","🤢":"#E67E22","🤮":"#11806A","🤧":"#9B59B6","🥵":"#E67E22","🥶":"#3498DB","🥴":"#F1C40F","😵":"#F1C40F","😵‍💫":"#F1C40F","🤯":"#E67E22","🤠":"#E67E22","🥳":"#F1C40F","🥸":"#E67E22","😎":"#11806A","🤓":"#E67E22","🧐":"#F1C40F","😕":"#F1C40F","🫤":"#F1C40F","😟":"#F1C40F","🙁":"#F1C40F","☹️":"#F1C40F","😮":"#F1C40F","😯":"#F1C40F","😲":"#F1C40F","😳":"#E67E22",
  "🥺":"#F1C40F","🥹":"#F1C40F","😦":"#F1C40F","😧":"#F1C40F","😨":"#5865F2","😰":"#E67E22","😥":"#F1C40F","😢":"#F1C40F","😭":"#F1C40F","😱":"#9B59B6","😖":"#F1C40F","😣":"#F1C40F","😞":"#F1C40F","😓":"#F1C40F","😩":"#F1C40F","😫":"#F1C40F","🥱":"#F1C40F","😤":"#F1C40F","😡":"#E67E22","😠":"#F1C40F","🤬":"#992D22","😈":"#9B59B6","👿":"#9B59B6","💀":"#9B59B6","☠️":"#9B59B6","💩":"#992D22","🤡":"#9B59B6","👹":"#E74C3C","👺":"#E74C3C","👻":"#9B59B6","👽":"#9B59B6","👾":"#9B59B6","🤖":"#607D8B","😺":"#E67E22","😸":"#E67E22","😹":"#E67E22","😻":"#E67E22","😼":"#E67E22","😽":"#E67E22","🙀":"#E67E22","😿":"#E67E22","😾":"#E67E22","🙈":"#E67E22","🙉":"#E67E22","🙊":"#E67E22","💋":"#992D22","💌":"#9B59B6","💘":"#3498DB","💝":"#E91E63","💖":"#E91E63","💗":"#E91E63","💓":"#E91E63","💞":"#E91E63","💕":"#E91E63","💟":"#9B59B6","❣️":"#E74C3C","💔":"#E74C3C","❤️‍🔥":"#E74C3C","❤️‍🩹":"#9B59B6","❤️":"#E74C3C","🧡":"#E67E22","💛":"#F1C40F","💚":"#11806A","💙":"#3498DB","💜":"#9B59B6","🤎":"#992D22",
  "🖤":"#607D8B","🤍":"#9B59B6","💯":"#992D22","💢":"#E74C3C","💥":"#E74C3C","💫":"#F1C40F","💦":"#9B59B6","💨":"#9B59B6","🕳️":"#9B59B6","💣":"#11806A","💬":"#9B59B6","👁️‍🗨️":"#11806A","🗨️":"#206694","🗯️":"#9B59B6","💭":"#9B59B6","💤":"#206694","👋":"#F1C40F","🤚":"#F1C40F","🖐️":"#F1C40F","✋":"#F1C40F","🖖":"#F1C40F","🫱":"#F1C40F","🫲":"#F1C40F","🫳":"#F1C40F","🫴":"#F1C40F","👌":"#F1C40F","🤌":"#F1C40F","🤏":"#E67E22","✌️":"#F1C40F","🤞":"#F1C40F","🫰":"#F1C40F","🤟":"#F1C40F","🤘":"#F1C40F","🤙":"#F1C40F","👈":"#F1C40F","👉":"#F1C40F","👆":"#F1C40F","🖕":"#F1C40F","👇":"#E67E22","☝️":"#F1C40F","🫵":"#F1C40F","👍":"#F1C40F","👎":"#F1C40F","✊":"#F1C40F","👊":"#E67E22","🤛":"#F1C40F","🤜":"#E67E22","👏":"#F1C40F","🙌":"#F1C40F","🫶":"#E67E22","👐":"#F1C40F","🤲":"#F1C40F","🤝":"#F1C40F","🙏":"#F1C40F","✍️":"#607D8B","💅":"#F1C40F","🤳":"#9B59B6","💪":"#F1C40F","🦾":"#11806A","🦿":"#9B59B6","🦵":"#E67E22","🦶":"#F1C40F","👂":"#F1C40F","🦻":"#F1C40F","👃":"#F1C40F","🧠":"#9B59B6",
  "🫀":"#E74C3C","🫁":"#E74C3C","🦷":"#9B59B6","🦴":"#9B59B6","👀":"#9B59B6","👁️":"#9B59B6","👅":"#9B59B6","👄":"#E74C3C","🫦":"#E74C3C","👶":"#F1C40F","🧒":"#F1C40F","👦":"#F1C40F","👧":"#F1C40F","🧑":"#F1C40F","👱":"#F1C40F","👨":"#F1C40F","🧔":"#F1C40F","🧔‍♂️":"#F1C40F","🧔‍♀️":"#E67E22","👨‍🦰":"#F1C40F","👨‍🦱":"#F1C40F","👨‍🦳":"#F1C40F","👨‍🦲":"#F1C40F","👩":"#F1C40F","👩‍🦰":"#E67E22","🧑‍🦰":"#F1C40F","👩‍🦱":"#F1C40F","🧑‍🦱":"#F1C40F","👩‍🦳":"#F1C40F","🧑‍🦳":"#F1C40F","👩‍🦲":"#F1C40F","🧑‍🦲":"#F1C40F","👱‍♀️":"#F1C40F","👱‍♂️":"#F1C40F","🧓":"#F1C40F","👴":"#F1C40F","👵":"#F1C40F","🙍":"#F1C40F","🙍‍♂️":"#206694","🙍‍♀️":"#F1C40F","🙎":"#F1C40F","🙎‍♂️":"#F1C40F","🙎‍♀️":"#E67E22","🙅":"#9B59B6","🙅‍♂️":"#3498DB","🙅‍♀️":"#992D22","🙆":"#9B59B6","🙆‍♂️":"#206694","🙆‍♀️":"#992D22","💁":"#F1C40F","💁‍♂️":"#F1C40F","💁‍♀️":"#F1C40F","🙋":"#F1C40F","🙋‍♂️":"#F1C40F","🙋‍♀️":"#9B59B6","🧏":"#F1C40F","🧏‍♂️":"#206694","🧏‍♀️":"#E67E22","🙇":"#F1C40F","🙇‍♂️":"#206694",
  "🙇‍♀️":"#992D22","🤦":"#9B59B6","🤦‍♂️":"#206694","🤦‍♀️":"#992D22","🤷":"#E67E22","🤷‍♂️":"#F1C40F","🤷‍♀️":"#992D22","🧑‍⚕️":"#9B59B6","👨‍⚕️":"#F1C40F","👩‍⚕️":"#9B59B6","🧑‍🎓":"#F1C40F","👨‍🎓":"#F1C40F","👩‍🎓":"#E67E22","🧑‍🏫":"#E67E22","👨‍🏫":"#E67E22","👩‍🏫":"#E67E22","🧑‍⚖️":"#F1C40F","👨‍⚖️":"#F1C40F","👩‍⚖️":"#E67E22","🧑‍🌾":"#992D22","👨‍🌾":"#E67E22","👩‍🌾":"#992D22","🧑‍🍳":"#E67E22","👨‍🍳":"#E67E22","👩‍🍳":"#E67E22","🧑‍🔧":"#5865F2","👨‍🔧":"#206694","👩‍🔧":"#5865F2","🧑‍🏭":"#F1C40F","👨‍🏭":"#F1C40F","👩‍🏭":"#F1C40F","🧑‍💼":"#F1C40F","👨‍💼":"#F1C40F","👩‍💼":"#F1C40F","🧑‍🔬":"#9B59B6","👨‍🔬":"#9B59B6","👩‍🔬":"#9B59B6","🧑‍💻":"#9B59B6","👨‍💻":"#9B59B6","👩‍💻":"#9B59B6","🧑‍🎤":"#1ABC9C","👨‍🎤":"#206694","👩‍🎤":"#9B59B6","🧑‍🎨":"#E67E22","👨‍🎨":"#E67E22","👩‍🎨":"#E67E22","🧑‍✈️":"#992D22","👨‍✈️":"#F1C40F","👩‍✈️":"#992D22","🧑‍🚀":"#9B59B6","👨‍🚀":"#9B59B6","👩‍🚀":"#9B59B6","🧑‍🚒":"#992D22","👨‍🚒":"#992D22","👩‍🚒":"#992D22","👮":"#F1C40F",
  "👮‍♂️":"#F1C40F","👮‍♀️":"#F1C40F","🕵️":"#992D22","🕵️‍♂️":"#992D22","🕵️‍♀️":"#992D22","💂":"#E67E22","💂‍♂️":"#E67E22","💂‍♀️":"#E67E22","🥷":"#11806A","👷":"#F1C40F","👷‍♂️":"#F1C40F","👷‍♀️":"#F1C40F","🫅":"#E67E22","🤴":"#F1C40F","👸":"#F1C40F","👳":"#F1C40F","👳‍♂️":"#9B59B6","👳‍♀️":"#F1C40F","👲":"#992D22","🧕":"#206694","🤵":"#F1C40F","🤵‍♂️":"#992D22","🤵‍♀️":"#E67E22","👰":"#F1C40F","👰‍♂️":"#F1C40F","👰‍♀️":"#F1C40F","🤰":"#9B59B6","🫃":"#E67E22","🫄":"#9B59B6","🤱":"#992D22","👩‍🍼":"#992D22","👨‍🍼":"#E67E22","🧑‍🍼":"#E67E22","👼":"#F1C40F","🎅":"#9B59B6","🤶":"#9B59B6","🧑‍🎄":"#E67E22","🦸":"#E67E22","🦸‍♂️":"#E67E22","🦸‍♀️":"#E67E22","🦹":"#F1C40F","🦹‍♂️":"#F1C40F","🦹‍♀️":"#E67E22","🧙":"#992D22","🧙‍♂️":"#992D22","🧙‍♀️":"#992D22","🧚":"#E67E22","🧚‍♂️":"#E67E22","🧚‍♀️":"#3498DB","🧛":"#F1C40F","🧛‍♂️":"#607D8B","🧛‍♀️":"#E67E22","🧜":"#206694","🧜‍♂️":"#E67E22","🧜‍♀️":"#9B59B6","🧝":"#11806A","🧝‍♂️":"#F1C40F","🧝‍♀️":"#9B59B6","🧞":"#206694",
  "🧞‍♂️":"#3498DB","🧞‍♀️":"#9B59B6","🧟":"#11806A","🧟‍♂️":"#11806A","🧟‍♀️":"#11806A","🧌":"#992D22","💆":"#F1C40F","💆‍♂️":"#F1C40F","💆‍♀️":"#F1C40F","💇":"#F1C40F","💇‍♂️":"#F1C40F","💇‍♀️":"#F1C40F","🚶":"#206694","🚶‍♂️":"#206694","🚶‍♀️":"#206694","🧍":"#9B59B6","🧍‍♂️":"#992D22","🧍‍♀️":"#F1C40F","🧎":"#E67E22","🧎‍♂️":"#F1C40F","🧎‍♀️":"#E67E22","🧑‍🦯":"#206694","👨‍🦯":"#206694","👩‍🦯":"#206694","🧑‍🦼":"#11806A","👨‍🦼":"#992D22","👩‍🦼":"#992D22","🧑‍🦽":"#11806A","👨‍🦽":"#11806A","👩‍🦽":"#206694","🏃":"#F1C40F","🏃‍♂️":"#206694","🏃‍♀️":"#3498DB","💃":"#F1C40F","🕺":"#992D22","🕴️":"#607D8B","👯":"#E67E22","👯‍♂️":"#992D22","👯‍♀️":"#E67E22","🧖":"#9B59B6","🧖‍♂️":"#9B59B6","🧖‍♀️":"#F1C40F","🧗":"#9B59B6","🧗‍♂️":"#9B59B6","🧗‍♀️":"#9B59B6","🤺":"#9B59B6","🏇":"#992D22","⛷️":"#992D22","🏂":"#206694","🏌️":"#9B59B6","🏌️‍♂️":"#607D8B","🏌️‍♀️":"#E67E22","🏄":"#E67E22","🏄‍♂️":"#F1C40F","🏄‍♀️":"#9B59B6","🚣":"#E74C3C","🚣‍♂️":"#E74C3C","🚣‍♀️":"#E74C3C","🏊":"#9B59B6",
  "🏊‍♂️":"#9B59B6","🏊‍♀️":"#9B59B6","⛹️":"#E67E22","⛹️‍♂️":"#206694","⛹️‍♀️":"#E67E22","🏋️":"#E67E22","🏋️‍♂️":"#E67E22","🏋️‍♀️":"#992D22","🚴":"#11806A","🚴‍♂️":"#11806A","🚴‍♀️":"#992D22","🚵":"#9B59B6","🚵‍♂️":"#9B59B6","🚵‍♀️":"#992D22","🤸":"#F1C40F","🤸‍♂️":"#206694","🤸‍♀️":"#F1C40F","🤼":"#E67E22","🤼‍♂️":"#E67E22","🤼‍♀️":"#E67E22","🤽":"#E67E22","🤽‍♂️":"#E67E22","🤽‍♀️":"#E67E22","🤾":"#9B59B6","🤾‍♂️":"#E67E22","🤾‍♀️":"#E67E22","🤹":"#E67E22","🤹‍♂️":"#F1C40F","🤹‍♀️":"#E67E22","🧘":"#F1C40F","🧘‍♂️":"#E67E22","🧘‍♀️":"#F1C40F","🛀":"#9B59B6","🛌":"#9B59B6","🧑‍🤝‍🧑":"#9B59B6","👭":"#F1C40F","👫":"#F1C40F","👬":"#E67E22","💏":"#9B59B6","👩‍❤️‍💋‍👨":"#9B59B6","👨‍❤️‍💋‍👨":"#9B59B6","👩‍❤️‍💋‍👩":"#9B59B6","💑":"#9B59B6","👩‍❤️‍👨":"#9B59B6","👨‍❤️‍👨":"#9B59B6","👩‍❤️‍👩":"#9B59B6","👪":"#F1C40F","👨‍👩‍👦":"#206694","👨‍👩‍👧":"#F1C40F","👨‍👩‍👧‍👦":"#F1C40F","👨‍👩‍👦‍👦":"#F1C40F","👨‍👩‍👧‍👧":"#F1C40F","👨‍👨‍👦":"#206694","👨‍👨‍👧":"#F1C40F",
  "👨‍👨‍👧‍👦":"#206694","👨‍👨‍👦‍👦":"#206694","👨‍👨‍👧‍👧":"#F1C40F","👩‍👩‍👦":"#E67E22","👩‍👩‍👧":"#E67E22","👩‍👩‍👧‍👦":"#E67E22","👩‍👩‍👦‍👦":"#F1C40F","👩‍👩‍👧‍👧":"#E67E22","👨‍👦":"#F1C40F","👨‍👦‍👦":"#206694","👨‍👧":"#206694","👨‍👧‍👦":"#F1C40F","👨‍👧‍👧":"#F1C40F","👩‍👦":"#F1C40F","👩‍👦‍👦":"#F1C40F","👩‍👧":"#F1C40F","👩‍👧‍👦":"#F1C40F","👩‍👧‍👧":"#F1C40F","🗣️":"#607D8B","👤":"#607D8B","👥":"#607D8B","🫂":"#607D8B","👣":"#11806A","🐵":"#E67E22","🐒":"#E67E22","🦍":"#206694","🦧":"#992D22","🐶":"#9B59B6","🐕":"#E67E22","🦮":"#E67E22","🐕‍🦺":"#992D22","🐩":"#9B59B6","🐺":"#9B59B6","🦊":"#E67E22","🦝":"#992D22","🐱":"#F1C40F","🐈":"#9B59B6","🐈‍⬛":"#11806A","🦁":"#E67E22","🐯":"#F1C40F","🐅":"#992D22","🐆":"#E67E22","🐴":"#992D22","🐎":"#992D22","🦄":"#9B59B6","🦓":"#206694","🦌":"#E67E22","🦬":"#992D22","🐮":"#9B59B6","🐂":"#E74C3C","🐃":"#992D22","🐄":"#9B59B6","🐷":"#9B59B6","🐖":"#9B59B6","🐗":"#992D22","🐽":"#9B59B6","🐏":"#9B59B6","🐑":"#9B59B6",
  "🐐":"#9B59B6","🐪":"#E67E22","🐫":"#E67E22","🦙":"#9B59B6","🦒":"#E67E22","🐘":"#9B59B6","🦣":"#992D22","🦏":"#9B59B6","🦛":"#9B59B6","🐭":"#9B59B6","🐁":"#9B59B6","🐀":"#9B59B6","🐹":"#9B59B6","🐰":"#9B59B6","🐇":"#9B59B6","🐿️":"#992D22","🦫":"#992D22","🦔":"#992D22","🦇":"#992D22","🐻":"#992D22","🐻‍❄️":"#9B59B6","🐨":"#9B59B6","🐼":"#11806A","🦥":"#992D22","🦦":"#992D22","🦨":"#9B59B6","🦘":"#E67E22","🦡":"#9B59B6","🐾":"#11806A","🦃":"#992D22","🐔":"#E74C3C","🐓":"#9B59B6","🐣":"#F1C40F","🐤":"#F1C40F","🐥":"#F1C40F","🐦":"#9B59B6","🐧":"#E67E22","🕊️":"#9B59B6","🦅":"#992D22","🦆":"#9B59B6","🦢":"#9B59B6","🦉":"#992D22","🦤":"#E67E22","🪶":"#992D22","🦩":"#E74C3C","🦚":"#11806A","🦜":"#11806A","🐸":"#11806A","🐊":"#11806A","🐢":"#11806A","🦎":"#11806A","🐍":"#992D22","🐲":"#F1C40F","🐉":"#992D22","🦕":"#206694","🦖":"#11806A","🐳":"#3498DB","🐋":"#9B59B6","🐬":"#3498DB","🦭":"#9B59B6","🐟":"#3498DB","🐠":"#F1C40F","🐡":"#E67E22","🦈":"#9B59B6","🐙":"#992D22","🐚":"#9B59B6",
  "🪸":"#E74C3C","🐌":"#E67E22","🦋":"#11806A","🐛":"#992D22","🐜":"#992D22","🐝":"#607D8B","🪲":"#11806A","🐞":"#992D22","🦗":"#992D22","🪳":"#992D22","🕷️":"#11806A","🕸️":"#9B59B6","🦂":"#992D22","🦟":"#992D22","🪰":"#E67E22","🪱":"#E74C3C","🦠":"#11806A","💐":"#F1C40F","🌸":"#9B59B6","💮":"#9B59B6","🪷":"#9B59B6","🏵️":"#E67E22","🌹":"#992D22","🥀":"#9B59B6","🌺":"#E91E63","🌻":"#F1C40F","🌼":"#F1C40F","🌷":"#E74C3C","🌱":"#11806A","🪴":"#11806A","🌲":"#11806A","🌳":"#11806A","🌴":"#11806A","🌵":"#11806A","🌾":"#E67E22","🌿":"#11806A","☘️":"#11806A","🍀":"#11806A","🍁":"#992D22","🍂":"#992D22","🍃":"#11806A","🪹":"#992D22","🪺":"#3498DB","🍇":"#992D22","🍈":"#9B59B6","🍉":"#E74C3C","🍊":"#E67E22","🍋":"#F1C40F","🍌":"#9B59B6","🍍":"#992D22","🥭":"#E67E22","🍎":"#E74C3C","🍏":"#11806A","🍐":"#E67E22","🍑":"#E74C3C","🍒":"#E74C3C","🍓":"#992D22","🫐":"#206694","🥝":"#F1C40F","🍅":"#E74C3C","🫒":"#992D22","🥥":"#9B59B6","🥑":"#F1C40F","🍆":"#992D22","🥔":"#992D22","🥕":"#E67E22",
  "🌽":"#992D22","🌶️":"#E74C3C","🫑":"#11806A","🥒":"#F1C40F","🥬":"#11806A","🥦":"#11806A","🧄":"#9B59B6","🧅":"#E67E22","🍄":"#E74C3C","🥜":"#E67E22","🫘":"#992D22","🌰":"#992D22","🍞":"#E67E22","🥐":"#E67E22","🥖":"#F1C40F","🫓":"#9B59B6","🥨":"#E74C3C","🥯":"#E67E22","🥞":"#F1C40F","🧇":"#E67E22","🧀":"#F1C40F","🍖":"#992D22","🍗":"#992D22","🥩":"#992D22","🥓":"#E74C3C","🍔":"#E67E22","🍟":"#F1C40F","🍕":"#E67E22","🌭":"#E67E22","🥪":"#F1C40F","🌮":"#F1C40F","🌯":"#9B59B6","🫔":"#E67E22","🥙":"#E67E22","🧆":"#992D22","🥚":"#9B59B6","🍳":"#11806A","🥘":"#E67E22","🍲":"#9B59B6","🫕":"#992D22","🥣":"#3498DB","🥗":"#11806A","🍿":"#E74C3C","🧈":"#F1C40F","🧂":"#9B59B6","🥫":"#E74C3C","🍱":"#992D22","🍘":"#992D22","🍙":"#9B59B6","🍚":"#9B59B6","🍛":"#9B59B6","🍜":"#9B59B6","🍝":"#F1C40F","🍠":"#E74C3C","🍢":"#E67E22","🍣":"#E74C3C","🍤":"#E67E22","🍥":"#9B59B6","🥮":"#992D22","🍡":"#9B59B6","🥟":"#F1C40F","🥠":"#E67E22","🥡":"#9B59B6","🦀":"#E74C3C","🦞":"#992D22","🦐":"#E74C3C",
  "🦑":"#E74C3C","🦪":"#9B59B6","🍦":"#E67E22","🍧":"#9B59B6","🍨":"#9B59B6","🍩":"#992D22","🍪":"#E67E22","🎂":"#9B59B6","🍰":"#9B59B6","🧁":"#E67E22","🥧":"#E67E22","🍫":"#E74C3C","🍬":"#9B59B6","🍭":"#9B59B6","🍮":"#9B59B6","🍯":"#F1C40F","🍼":"#9B59B6","🥛":"#9B59B6","☕":"#9B59B6","🫖":"#9B59B6","🍵":"#9B59B6","🍶":"#9B59B6","🍾":"#992D22","🍷":"#9B59B6","🍸":"#9B59B6","🍹":"#F1C40F","🍺":"#E67E22","🍻":"#E67E22","🥂":"#9B59B6","🥃":"#9B59B6","🫗":"#9B59B6","🥤":"#E74C3C","🧋":"#E67E22","🧃":"#9B59B6","🧉":"#992D22","🧊":"#3498DB","🥢":"#992D22","🍽️":"#9B59B6","🍴":"#9B59B6","🥄":"#607D8B","🔪":"#9B59B6","🫙":"#9B59B6","🏺":"#992D22","🌍":"#F1C40F","🌎":"#206694","🌏":"#F1C40F","🌐":"#3498DB","🗺️":"#3498DB","🗾":"#3498DB","🧭":"#9B59B6","🏔️":"#11806A","⛰️":"#11806A","🌋":"#11806A","🗻":"#9B59B6","🏕️":"#992D22","🏖️":"#E67E22","🏜️":"#992D22","🏝️":"#3498DB","🏞️":"#3498DB","🏟️":"#9B59B6","🏛️":"#9B59B6","🏗️":"#F1C40F","🧱":"#992D22","🪨":"#11806A","🪵":"#992D22","🛖":"#992D22",
  "🏘️":"#9B59B6","🏚️":"#9B59B6","🏠":"#9B59B6","🏡":"#11806A","🏢":"#9B59B6","🏣":"#9B59B6","🏤":"#9B59B6","🏥":"#9B59B6","🏦":"#9B59B6","🏨":"#9B59B6","🏩":"#9B59B6","🏪":"#607D8B","🏫":"#9B59B6","🏬":"#607D8B","🏭":"#9B59B6","🏯":"#206694","🏰":"#9B59B6","💒":"#9B59B6","🗼":"#992D22","🗽":"#607D8B","⛪":"#9B59B6","🕌":"#E67E22","🛕":"#E67E22","🕍":"#E67E22","⛩️":"#992D22","🕋":"#992D22","⛲":"#9B59B6","⛺":"#E74C3C","🌁":"#9B59B6","🌃":"#206694","🏙️":"#206694","🌄":"#9B59B6","🌅":"#E67E22","🌆":"#E67E22","🌇":"#E67E22","🌉":"#206694","♨️":"#992D22","🎠":"#9B59B6","🛝":"#206694","🎡":"#992D22","🎢":"#E67E22","💈":"#9B59B6","🎪":"#9B59B6","🚂":"#992D22","🚃":"#607D8B","🚄":"#9B59B6","🚅":"#206694","🚆":"#607D8B","🚇":"#11806A","🚈":"#206694","🚉":"#206694","🚊":"#11806A","🚝":"#206694","🚞":"#9B59B6","🚋":"#11806A","🚌":"#3498DB","🚍":"#607D8B","🚎":"#206694","🚐":"#9B59B6","🚑":"#11806A","🚒":"#11806A","🚓":"#11806A","🚔":"#11806A","🚕":"#E67E22","🚖":"#992D22","🚗":"#9B59B6",
  "🚘":"#E74C3C","🚙":"#3498DB","🛻":"#206694","🚚":"#E67E22","🚛":"#11806A","🚜":"#F1C40F","🏎️":"#E74C3C","🏍️":"#11806A","🛵":"#E67E22","🦽":"#11806A","🦼":"#992D22","🛺":"#F1C40F","🚲":"#11806A","🛴":"#607D8B","🛹":"#11806A","🛼":"#3498DB","🚏":"#9B59B6","🛣️":"#11806A","🛤️":"#992D22","🛢️":"#992D22","⛽":"#E74C3C","🛞":"#11806A","🚨":"#E74C3C","🚥":"#9B59B6","🚦":"#11806A","🛑":"#9B59B6","🚧":"#607D8B","⚓":"#206694","🛟":"#9B59B6","⛵":"#992D22","🛶":"#992D22","🚤":"#9B59B6","🛳️":"#9B59B6","⛴️":"#206694","🛥️":"#9B59B6","🚢":"#9B59B6","✈️":"#3498DB","🛩️":"#9B59B6","🛫":"#206694","🛬":"#206694","🪂":"#992D22","💺":"#607D8B","🚁":"#E74C3C","🚟":"#9B59B6","🚠":"#992D22","🚡":"#F1C40F","🛰️":"#206694","🚀":"#9B59B6","🛸":"#206694","🛎️":"#992D22","🧳":"#992D22","⌛":"#9B59B6","⏳":"#9B59B6","⌚":"#992D22","⏰":"#9B59B6","⏱️":"#9B59B6","⏲️":"#9B59B6","🕰️":"#9B59B6","🕛":"#9B59B6","🕧":"#9B59B6","🕐":"#9B59B6","🕜":"#9B59B6","🕑":"#9B59B6","🕝":"#9B59B6","🕒":"#9B59B6","🕞":"#9B59B6",
  "🕓":"#9B59B6","🕟":"#9B59B6","🕔":"#9B59B6","🕠":"#9B59B6","🕕":"#9B59B6","🕡":"#9B59B6","🕖":"#9B59B6","🕢":"#9B59B6","🕗":"#9B59B6","🕣":"#9B59B6","🕘":"#9B59B6","🕤":"#9B59B6","🕙":"#9B59B6","🕥":"#9B59B6","🕚":"#9B59B6","🕦":"#9B59B6","🌑":"#11806A","🌒":"#11806A","🌓":"#11806A","🌔":"#11806A","🌕":"#F1C40F","🌖":"#11806A","🌗":"#11806A","🌘":"#11806A","🌙":"#F1C40F","🌚":"#206694","🌛":"#F1C40F","🌜":"#F1C40F","🌡️":"#9B59B6","☀️":"#F1C40F","🌝":"#F1C40F","🌞":"#F1C40F","🪐":"#E67E22","⭐":"#9B59B6","🌟":"#9B59B6","🌠":"#206694","🌌":"#9B59B6","☁️":"#9B59B6","⛅":"#9B59B6","⛈️":"#9B59B6","🌤️":"#9B59B6","🌥️":"#9B59B6","🌦️":"#F1C40F","🌧️":"#9B59B6","🌨️":"#9B59B6","🌩️":"#9B59B6","🌪️":"#607D8B","🌫️":"#9B59B6","🌬️":"#9B59B6","🌀":"#206694","🌈":"#1ABC9C","🌂":"#206694","☂️":"#9B59B6","☔":"#5865F2","⛱️":"#F1C40F","⚡":"#F1C40F","❄️":"#3498DB","☃️":"#9B59B6","⛄":"#9B59B6","☄️":"#E67E22","🔥":"#E67E22","💧":"#3498DB","🌊":"#9B59B6","🎃":"#E67E22","🎄":"#11806A","🎆":"#9B59B6",
  "🎇":"#992D22","🧨":"#992D22","✨":"#F1C40F","🎈":"#E74C3C","🎉":"#E67E22","🎊":"#E67E22","🎋":"#E67E22","🎍":"#E67E22","🎎":"#206694","🎏":"#E67E22","🎐":"#9B59B6","🎑":"#11806A","🧧":"#E74C3C","🎀":"#9B59B6","🎁":"#E67E22","🎗️":"#F1C40F","🎟️":"#E74C3C","🎫":"#F1C40F","🎖️":"#F1C40F","🏆":"#E67E22","🏅":"#F1C40F","🥇":"#F1C40F","🥈":"#9B59B6","🥉":"#992D22","⚽":"#9B59B6","⚾":"#9B59B6","🥎":"#F1C40F","🏀":"#E67E22","🏐":"#9B59B6","🏈":"#E74C3C","🏉":"#E67E22","🎾":"#F1C40F","🥏":"#3498DB","🎳":"#9B59B6","🏏":"#F1C40F","🏑":"#9B59B6","🏒":"#E67E22","🥍":"#206694","🏓":"#E74C3C","🏸":"#E67E22","🥊":"#E74C3C","🥋":"#9B59B6","🥅":"#992D22","⛳":"#11806A","⛸️":"#9B59B6","🎣":"#607D8B","🤿":"#11806A","🎽":"#3498DB","🎿":"#3498DB","🛷":"#992D22","🥌":"#11806A","🎯":"#9B59B6","🪀":"#11806A","🪁":"#206694","🎱":"#11806A","🔮":"#9B59B6","🪄":"#9B59B6","🧿":"#206694","🪬":"#206694","🎮":"#11806A","🕹️":"#11806A","🎰":"#9B59B6","🎲":"#9B59B6","🧩":"#1ABC9C","🧸":"#E67E22","🪅":"#9B59B6",
  "🪩":"#9B59B6","🪆":"#E67E22","♠️":"#607D8B","♥️":"#607D8B","♦️":"#607D8B","♣️":"#607D8B","♟️":"#607D8B","🃏":"#9B59B6","🀄":"#9B59B6","🎴":"#992D22","🎭":"#992D22","🖼️":"#F1C40F","🎨":"#E67E22","🧵":"#E67E22","🪡":"#206694","🧶":"#E67E22","🪢":"#206694","👓":"#9B59B6","🕶️":"#607D8B","🥽":"#9B59B6","🥼":"#9B59B6","🦺":"#E74C3C","👔":"#3498DB","👕":"#3498DB","👖":"#206694","🧣":"#992D22","🧤":"#1ABC9C","🧥":"#E67E22","🧦":"#9B59B6","👗":"#1ABC9C","👘":"#E67E22","🥻":"#E67E22","🩱":"#11806A","🩲":"#11806A","🩳":"#E67E22","👙":"#9B59B6","👚":"#9B59B6","👛":"#9B59B6","👜":"#E74C3C","👝":"#992D22","🛍️":"#9B59B6","🎒":"#E74C3C","🩴":"#3498DB","👞":"#992D22","👟":"#9B59B6","🥾":"#992D22","🥿":"#206694","👠":"#E74C3C","👡":"#9B59B6","🩰":"#9B59B6","👢":"#E67E22","👑":"#E67E22","👒":"#E67E22","🎩":"#11806A","🎓":"#992D22","🧢":"#3498DB","🪖":"#11806A","⛑️":"#992D22","📿":"#992D22","💄":"#E74C3C","💍":"#9B59B6","💎":"#3498DB","🔇":"#11806A","🔈":"#11806A","🔉":"#607D8B","🔊":"#11806A",
  "📢":"#9B59B6","📣":"#992D22","📯":"#E74C3C","🔔":"#992D22","🔕":"#992D22","🎼":"#9B59B6","🎵":"#11806A","🎶":"#11806A","🎙️":"#11806A","🎚️":"#9B59B6","🎛️":"#9B59B6","🎤":"#9B59B6","🎧":"#9B59B6","📻":"#E67E22","🎷":"#E67E22","🪗":"#992D22","🎸":"#E74C3C","🎹":"#607D8B","🎺":"#E67E22","🎻":"#992D22","🪕":"#9B59B6","🥁":"#E74C3C","🪘":"#992D22","📱":"#607D8B","📲":"#607D8B","☎️":"#E74C3C","📞":"#11806A","📟":"#11806A","📠":"#9B59B6","🔋":"#11806A","🪫":"#9B59B6","🔌":"#11806A","💻":"#607D8B","🖥️":"#11806A","🖨️":"#607D8B","⌨️":"#9B59B6","🖱️":"#9B59B6","🖲️":"#11806A","💽":"#9B59B6","💾":"#11806A","💿":"#9B59B6","📀":"#9B59B6","🧮":"#992D22","🎥":"#11806A","🎞️":"#9B59B6","📽️":"#206694","🎬":"#11806A","📺":"#992D22","📷":"#11806A","📸":"#11806A","📹":"#607D8B","📼":"#11806A","🔍":"#11806A","🔎":"#11806A","🕯️":"#9B59B6","💡":"#9B59B6","🔦":"#607D8B","🏮":"#E74C3C","🪔":"#992D22","📔":"#F1C40F","📕":"#992D22","📖":"#206694","📗":"#E67E22","📘":"#206694","📙":"#E67E22","📚":"#11806A",
  "📓":"#9B59B6","📒":"#F1C40F","📃":"#9B59B6","📜":"#9B59B6","📄":"#9B59B6","📰":"#9B59B6","🗞️":"#9B59B6","📑":"#9B59B6","🔖":"#9B59B6","🏷️":"#F1C40F","💰":"#E67E22","🪙":"#206694","💴":"#9B59B6","💵":"#9B59B6","💶":"#9B59B6","💷":"#9B59B6","💸":"#9B59B6","💳":"#9B59B6","🧾":"#9B59B6","💹":"#9B59B6","✉️":"#9B59B6","📧":"#9B59B6","📨":"#9B59B6","📩":"#9B59B6","📤":"#3498DB","📥":"#3498DB","📦":"#E67E22","📫":"#206694","📪":"#3498DB","📬":"#607D8B","📭":"#11806A","📮":"#E74C3C","🗳️":"#3498DB","✏️":"#E67E22","✒️":"#11806A","🖋️":"#11806A","🖊️":"#11806A","🖌️":"#206694","🖍️":"#E74C3C","📝":"#9B59B6","💼":"#992D22","📁":"#9B59B6","📂":"#9B59B6","🗂️":"#E67E22","📅":"#E74C3C","📆":"#9B59B6","🗒️":"#9B59B6","🗓️":"#9B59B6","📇":"#9B59B6","📈":"#9B59B6","📉":"#9B59B6","📊":"#9B59B6","📋":"#9B59B6","📌":"#E74C3C","📍":"#E74C3C","📎":"#9B59B6","🖇️":"#9B59B6","📏":"#9B59B6","📐":"#9B59B6","✂️":"#9B59B6","🗃️":"#11806A","🗄️":"#206694","🗑️":"#9B59B6","🔒":"#E67E22","🔓":"#E67E22",
  "🔏":"#9B59B6","🔐":"#E67E22","🔑":"#F1C40F","🗝️":"#11806A","🔨":"#9B59B6","🪓":"#992D22","⛏️":"#9B59B6","⚒️":"#11806A","🛠️":"#11806A","🗡️":"#9B59B6","⚔️":"#11806A","🔫":"#1ABC9C","🪃":"#E74C3C","🏹":"#9B59B6","🛡️":"#9B59B6","🪚":"#9B59B6","🔧":"#206694","🪛":"#1ABC9C","🔩":"#9B59B6","⚙️":"#9B59B6","🗜️":"#607D8B","⚖️":"#607D8B","🦯":"#9B59B6","🔗":"#206694","⛓️":"#9B59B6","🪝":"#E67E22","🧰":"#E74C3C","🧲":"#E74C3C","🪜":"#992D22","⚗️":"#9B59B6","🧪":"#11806A","🧫":"#9B59B6","🧬":"#3498DB","🔬":"#9B59B6","🔭":"#9B59B6","📡":"#9B59B6","💉":"#9B59B6","🩸":"#E74C3C","💊":"#F1C40F","🩹":"#9B59B6","🩼":"#9B59B6","🩺":"#11806A","🩻":"#3498DB","🚪":"#992D22","🛗":"#3498DB","🪞":"#E67E22","🪟":"#992D22","🛏️":"#992D22","🛋️":"#3498DB","🪑":"#E74C3C","🚽":"#9B59B6","🪠":"#E74C3C","🚿":"#9B59B6","🛁":"#9B59B6","🪤":"#F1C40F","🪒":"#9B59B6","🧴":"#9B59B6","🧷":"#9B59B6","🧹":"#992D22","🧺":"#992D22","🧻":"#9B59B6","🪣":"#206694","🧼":"#1ABC9C","🫧":"#9B59B6","🪥":"#9B59B6","🧽":"#F1C40F",
  "🧯":"#E74C3C","🛒":"#9B59B6","🚬":"#9B59B6","⚰️":"#992D22","🪦":"#9B59B6","⚱️":"#E67E22","🗿":"#206694","🪧":"#9B59B6","🪪":"#9B59B6","🏧":"#3498DB","🚮":"#9B59B6","🚰":"#9B59B6","♿":"#9B59B6","🚹":"#3498DB","🚺":"#9B59B6","🚻":"#607D8B","🚼":"#E67E22","🚾":"#9B59B6","🛂":"#9B59B6","🛃":"#9B59B6","🛄":"#9B59B6","🛅":"#9B59B6","⚠️":"#F1C40F","🚸":"#F1C40F","⛔":"#9B59B6","🚫":"#E74C3C","🚳":"#11806A","🚭":"#E74C3C","🚯":"#E74C3C","🚱":"#E74C3C","🚷":"#E74C3C","📵":"#E74C3C","🔞":"#607D8B","☢️":"#E67E22","☣️":"#E67E22","⬆️":"#607D8B","↗️":"#607D8B","➡️":"#607D8B","↘️":"#607D8B","⬇️":"#607D8B","↙️":"#607D8B","⬅️":"#607D8B","↖️":"#607D8B","↕️":"#607D8B","↔️":"#607D8B","↩️":"#607D8B","↪️":"#607D8B","⤴️":"#607D8B","⤵️":"#607D8B","🔃":"#607D8B","🔄":"#607D8B","🔙":"#11806A","🔚":"#11806A","🔛":"#11806A","🔜":"#206694","🔝":"#11806A","🛐":"#9B59B6","⚛️":"#9B59B6","🕉️":"#9B59B6","✡️":"#9B59B6","☸️":"#9B59B6","☯️":"#9B59B6","✝️":"#9B59B6","☦️":"#9B59B6","☪️":"#9B59B6","☮️":"#9B59B6",
  "🕎":"#9B59B6","🔯":"#9B59B6","♈":"#9B59B6","♉":"#9B59B6","♊":"#9B59B6","♋":"#9B59B6","♌":"#9B59B6","♍":"#9B59B6","♎":"#9B59B6","♏":"#9B59B6","♐":"#9B59B6","♑":"#9B59B6","♒":"#9B59B6","♓":"#9B59B6","⛎":"#9B59B6","🔀":"#607D8B","🔁":"#607D8B","🔂":"#607D8B","▶️":"#607D8B","⏩":"#607D8B","⏭️":"#607D8B","⏯️":"#607D8B","◀️":"#607D8B","⏪":"#607D8B","⏮️":"#607D8B","🔼":"#607D8B","⏫":"#607D8B","🔽":"#607D8B","⏬":"#607D8B","⏸️":"#607D8B","⏹️":"#607D8B","⏺️":"#607D8B","⏏️":"#607D8B","🎦":"#607D8B","🔅":"#F1C40F","🔆":"#F1C40F","📶":"#9B59B6","📳":"#F1C40F","📴":"#9B59B6","♀️":"#607D8B","♂️":"#607D8B","⚧️":"#607D8B","✖️":"#11806A","➕":"#11806A","➖":"#11806A","➗":"#11806A","🟰":"#9B59B6","♾️":"#607D8B","‼️":"#607D8B","⁉️":"#E74C3C","❓":"#992D22","❔":"#9B59B6","❕":"#9B59B6","❗":"#992D22","〰️":"#11806A","💱":"#206694","💲":"#206694","⚕️":"#607D8B","♻️":"#11806A","⚜️":"#992D22","🔱":"#E67E22","📛":"#9B59B6","🔰":"#F1C40F","⭕":"#992D22","✅":"#11806A","☑️":"#206694","✔️":"#11806A","❌":"#E74C3C",
  "❎":"#11806A","➰":"#11806A","➿":"#206694","〽️":"#F1C40F","✳️":"#11806A","✴️":"#9B59B6","❇️":"#11806A","©️":"#607D8B","®️":"#607D8B","™️":"#607D8B","#️⃣":"#607D8B","*️⃣":"#607D8B","0️⃣":"#607D8B","1️⃣":"#607D8B","2️⃣":"#607D8B","3️⃣":"#607D8B","4️⃣":"#607D8B","5️⃣":"#607D8B","6️⃣":"#607D8B","7️⃣":"#607D8B","8️⃣":"#607D8B","9️⃣":"#607D8B","🔟":"#607D8B","🔠":"#607D8B","🔡":"#607D8B","🔢":"#607D8B","🔣":"#607D8B","🔤":"#607D8B","🅰️":"#E74C3C","🆎":"#E74C3C","🅱️":"#9B59B6","🆑":"#E74C3C","🆒":"#607D8B","🆓":"#607D8B",ℹ️:"#9B59B6","🆔":"#9B59B6","Ⓜ️":"#9B59B6","🆕":"#607D8B","🆖":"#607D8B","🅾️":"#E74C3C","🆗":"#607D8B","🅿️":"#3498DB","🆘":"#9B59B6","🆙":"#607D8B","🆚":"#9B59B6","🈁":"#607D8B","🈂️":"#3498DB","🈷️":"#9B59B6","🈶":"#9B59B6","🈯":"#9B59B6","🉐":"#9B59B6","🈹":"#9B59B6","🈚":"#9B59B6","🈲":"#9B59B6","🉑":"#9B59B6","🈸":"#9B59B6","🈴":"#E74C3C","🈳":"#9B59B6","㊗️":"#9B59B6","㊙️":"#9B59B6","🈺":"#9B59B6","🈵":"#9B59B6","🔴":"#992D22","🟠":"#F1C40F","🟡":"#F1C40F",
  "🟢":"#11806A","🔵":"#206694","🟣":"#9B59B6","🟤":"#992D22","⚫":"#607D8B","⚪":"#9B59B6","🟥":"#E74C3C","🟧":"#E67E22","🟨":"#F1C40F","🟩":"#11806A","🟦":"#3498DB","🟪":"#9B59B6","🟫":"#9B59B6","⬛":"#11806A","⬜":"#9B59B6","◼️":"#607D8B","◻️":"#9B59B6","◾":"#607D8B","◽":"#9B59B6","▪️":"#607D8B","▫️":"#607D8B","🔶":"#F1C40F","🔷":"#206694","🔸":"#E67E22","🔹":"#206694","🔺":"#E74C3C","🔻":"#E74C3C","💠":"#3498DB","🔘":"#206694","🔳":"#9B59B6","🔲":"#607D8B","🏁":"#9B59B6","🚩":"#992D22","🎌":"#9B59B6","🏴":"#11806A","🏳️":"#9B59B6","🏳️‍🌈":"#E67E22","🏳️‍⚧️":"#9B59B6","🏴‍☠️":"#11806A","🇦🇨":"#206694","🇦🇩":"#206694","🇦🇪":"#E74C3C","🇦🇫":"#E74C3C","🇦🇬":"#992D22","🇦🇮":"#206694","🇦🇱":"#992D22","🇦🇲":"#E74C3C","🇦🇴":"#607D8B","🇦🇶":"#206694","🇦🇷":"#3498DB","🇦🇸":"#9B59B6","🇦🇹":"#9B59B6","🇦🇺":"#206694","🇦🇼":"#3498DB","🇦🇽":"#206694","🇦🇿":"#E91E63","🇧🇦":"#F1C40F","🇧🇧":"#206694","🇧🇩":"#E74C3C","🇧🇪":"#F1C40F","🇧🇫":"#11806A","🇧🇬":"#992D22","🇧🇭":"#9B59B6",
  "🇧🇮":"#11806A","🇧🇯":"#E74C3C","🇧🇱":"#9B59B6","🇧🇲":"#992D22","🇧🇳":"#F1C40F","🇧🇴":"#11806A","🇧🇶":"#206694","🇧🇷":"#F1C40F","🇧🇸":"#3498DB","🇧🇹":"#E67E22","🇧🇻":"#E74C3C","🇧🇼":"#3498DB","🇧🇾":"#11806A","🇧🇿":"#206694","🇨🇦":"#992D22","🇨🇨":"#11806A","🇨🇩":"#E74C3C","🇨🇫":"#11806A","🇨🇬":"#F1C40F","🇨🇭":"#9B59B6","🇨🇮":"#E67E22","🇨🇰":"#206694","🇨🇱":"#E74C3C","🇨🇲":"#E74C3C","🇨🇳":"#992D22","🇨🇴":"#206694","🇨🇵":"#206694","🇨🇷":"#206694","🇨🇺":"#206694","🇨🇻":"#206694","🇨🇼":"#206694","🇨🇽":"#11806A","🇨🇾":"#9B59B6","🇨🇿":"#992D22","🇩🇪":"#E74C3C","🇩🇬":"#9B59B6","🇩🇯":"#11806A","🇩🇰":"#992D22","🇩🇲":"#E67E22","🇩🇴":"#206694","🇩🇿":"#11806A","🇪🇦":"#F1C40F","🇪🇨":"#F1C40F","🇪🇪":"#9B59B6","🇪🇬":"#9B59B6","🇪🇭":"#9B59B6","🇪🇷":"#11806A","🇪🇸":"#F1C40F","🇪🇹":"#11806A","🇪🇺":"#206694","🇫🇮":"#206694","🇫🇯":"#3498DB","🇫🇰":"#206694","🇫🇲":"#3498DB","🇫🇴":"#3498DB","🇫🇷":"#206694","🇬🇦":"#11806A","🇬🇧":"#206694",
  "🇬🇩":"#11806A","🇬🇪":"#E74C3C","🇬🇫":"#11806A","🇬🇬":"#9B59B6","🇬🇭":"#11806A","🇬🇮":"#9B59B6","🇬🇱":"#992D22","🇬🇲":"#11806A","🇬🇳":"#F1C40F","🇬🇵":"#F1C40F","🇬🇶":"#11806A","🇬🇷":"#9B59B6","🇬🇸":"#206694","🇬🇹":"#3498DB","🇬🇺":"#206694","🇬🇼":"#F1C40F","🇬🇾":"#E67E22","🇭🇰":"#992D22","🇭🇲":"#206694","🇭🇳":"#9B59B6","🇭🇷":"#206694","🇭🇹":"#E91E63","🇭🇺":"#11806A","🇮🇨":"#206694","🇮🇩":"#992D22","🇮🇪":"#11806A","🇮🇱":"#206694","🇮🇲":"#992D22","🇮🇳":"#9B59B6","🇮🇴":"#9B59B6","🇮🇶":"#607D8B","🇮🇷":"#992D22","🇮🇸":"#9B59B6","🇮🇹":"#992D22","🇯🇪":"#9B59B6","🇯🇲":"#11806A","🇯🇴":"#E74C3C","🇯🇵":"#9B59B6","🇰🇪":"#E74C3C","🇰🇬":"#E74C3C","🇰🇭":"#992D22","🇰🇮":"#E74C3C","🇰🇲":"#11806A","🇰🇳":"#E74C3C","🇰🇵":"#206694","🇰🇷":"#9B59B6","🇰🇼":"#1ABC9C","🇰🇾":"#206694","🇰🇿":"#1ABC9C","🇱🇦":"#E74C3C","🇱🇧":"#9B59B6","🇱🇨":"#3498DB","🇱🇮":"#206694","🇱🇰":"#E74C3C","🇱🇷":"#E74C3C","🇱🇸":"#9B59B6","🇱🇹":"#11806A","🇱🇺":"#E74C3C",
  "🇱🇻":"#992D22","🇱🇾":"#E74C3C","🇲🇦":"#992D22","🇲🇨":"#9B59B6","🇲🇩":"#206694","🇲🇪":"#992D22","🇲🇫":"#206694","🇲🇬":"#E74C3C","🇲🇭":"#206694","🇲🇰":"#992D22","🇲🇱":"#F1C40F","🇲🇲":"#F1C40F","🇲🇳":"#206694","🇲🇴":"#11806A","🇲🇵":"#9B59B6","🇲🇶":"#206694","🇲🇷":"#E74C3C","🇲🇸":"#206694","🇲🇹":"#9B59B6","🇲🇺":"#E74C3C","🇲🇻":"#11806A","🇲🇼":"#992D22","🇲🇽":"#9B59B6","🇲🇾":"#9B59B6","🇲🇿":"#E67E22","🇳🇦":"#E74C3C","🇳🇨":"#E67E22","🇳🇪":"#11806A","🇳🇫":"#9B59B6","🇳🇬":"#9B59B6","🇳🇮":"#5865F2","🇳🇱":"#206694","🇳🇴":"#E74C3C","🇳🇵":"#992D22","🇳🇷":"#206694","🇳🇺":"#F1C40F","🇳🇿":"#206694","🇴🇲":"#11806A","🇵🇦":"#206694","🇵🇪":"#9B59B6","🇵🇫":"#992D22","🇵🇬":"#E74C3C","🇵🇭":"#992D22","🇵🇰":"#11806A","🇵🇱":"#E74C3C","🇵🇲":"#206694","🇵🇳":"#206694","🇵🇷":"#992D22","🇵🇸":"#9B59B6","🇵🇹":"#E74C3C","🇵🇼":"#F1C40F","🇵🇾":"#9B59B6","🇶🇦":"#9B59B6","🇷🇪":"#E74C3C","🇷🇴":"#F1C40F","🇷🇸":"#206694","🇷🇺":"#992D22","🇷🇼":"#F1C40F",
  "🇸🇦":"#11806A","🇸🇧":"#11806A","🇸🇨":"#11806A","🇸🇩":"#9B59B6","🇸🇪":"#F1C40F","🇸🇬":"#E74C3C","🇸🇭":"#206694","🇸🇮":"#E74C3C","🇸🇯":"#E74C3C","🇸🇰":"#992D22","🇸🇱":"#9B59B6","🇸🇲":"#9B59B6","🇸🇳":"#F1C40F","🇸🇴":"#3498DB","🇸🇷":"#11806A","🇸🇸":"#E74C3C","🇸🇹":"#E67E22","🇸🇻":"#9B59B6","🇸🇽":"#E74C3C","🇸🇾":"#992D22","🇸🇿":"#992D22","🇹🇦":"#206694","🇹🇨":"#206694","🇹🇩":"#F1C40F","🇹🇫":"#206694","🇹🇬":"#11806A","🇹🇭":"#992D22","🇹🇯":"#E91E63","🇹🇰":"#F1C40F","🇹🇱":"#E74C3C","🇹🇲":"#11806A","🇹🇳":"#992D22","🇹🇴":"#992D22","🇹🇷":"#E74C3C","🇹🇹":"#992D22","🇹🇻":"#607D8B","🇹🇼":"#3498DB","🇹🇿":"#11806A","🇺🇦":"#F1C40F","🇺🇬":"#607D8B","🇺🇲":"#E74C3C","🇺🇳":"#3498DB","🇺🇸":"#E74C3C","🇺🇾":"#9B59B6","🇺🇿":"#1ABC9C","🇻🇦":"#9B59B6","🇻🇨":"#F1C40F","🇻🇪":"#206694","🇻🇬":"#206694","🇻🇮":"#9B59B6","🇻🇳":"#992D22","🇻🇺":"#11806A","🇼🇫":"#E74C3C","🇼🇸":"#E74C3C","🇽🇰":"#206694","🇾🇪":"#E74C3C","🇾🇹":"#9B59B6","🇿🇦":"#E67E22",
  "🇿🇲":"#11806A","🇿🇼":"#11806A","🏴󠁧󠁢󠁥󠁮󠁧󠁿":"#992D22","🏴󠁧󠁢󠁳󠁣󠁴󠁿":"#206694","🏴󠁧󠁢󠁷󠁬󠁳󠁿":"#11806A"})
