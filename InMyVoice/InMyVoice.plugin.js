/**
 * @name InMyVoice
 * @author arg0NNY
 * @authorLink https://github.com/okdevme/DiscordPlugins
 * @invite M8DBtcZjXD
 * @donate https://donationalerts.com/r/arg0nny
 * @version 1.2.4
 * @description Shows if a person in the text chat is also in a voice chat you're in.
 * @website https://github.com/okdevme/DiscordPlugins/tree/master/InMyVoice
 * @source https://github.com/okdevme/DiscordPlugins/blob/master/InMyVoice/InMyVoice.plugin.js
 * @runAt idle
 */

/* ### CONFIG START ### */
const config = {
  info: {
    name: 'InMyVoice',
    version: '1.2.4',
    description: 'Shows if a person in the text chat is also in a voice chat you\'re in.'
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
  UI,
  React,
  Patcher,
  Utils,
  Data
} = new BdApi(config.info.name)

const UserStore = Webpack.getStore('UserStore')
const ChannelStore = Webpack.getStore('ChannelStore')
const SelectedChannelStore = Webpack.getStore('SelectedChannelStore')

const findInReactTree = (tree, searchFilter) => Utils.findInTree(tree, searchFilter, { walkable: ['props', 'children', 'child', 'sibling'] })

const Selectors = {
  BotTag: {
    botTagCozy: Webpack.getByKeys('botTagCozy').botTagCozy,
    botTagVerified: Webpack.getByKeys('botTagVerified').botTagVerified
  }
}

const UNIQUE_TAG = 'InMyVoiceTag'

const VoiceChannelStore = Webpack.getByKeys('getVoiceStatesForChannel')
const MessageHeader = [...Webpack.getWithKey(Webpack.Filters.byStrings('decorations', 'withMentionPrefix'))]
const BotTag = [...Webpack.getWithKey(m => m?.Types?.SYSTEM_DM)]
const useStateFromStores = Webpack.getModule(Webpack.Filters.byStrings('useStateFromStores'), { searchExports: true })

function isInMyVoice (user) {
  const voiceChannelId = useStateFromStores([SelectedChannelStore], () => SelectedChannelStore.getVoiceChannelId())
  const currentUser = useStateFromStores([UserStore], () => UserStore.getCurrentUser())
  const channel = useStateFromStores([ChannelStore], () => voiceChannelId && ChannelStore.getChannel(voiceChannelId))
  const voiceState = useStateFromStores([VoiceChannelStore], () => channel && VoiceChannelStore.getVoiceStatesForChannel(channel))

  if (currentUser.id === user.id || !channel) return false

  const values = Object.values(voiceState)
  return values.findIndex(x => x.user?.id === user.id) !== -1
}

function InVoiceTag ({ user }) {
  if (!isInMyVoice(user)) return null

  return React.createElement(BotTag[0][BotTag[1]], {
    className: `${Selectors.BotTag.botTagCozy} ${UNIQUE_TAG}`,
    useRemSizes: true,
    type: 'IN_VOICE'
  })
}

module.exports = class InMyVoice {
  start () {
    this.patches()
  }

  patches () {
    this.patchMessages()
    this.patchBotTags()
  }

  patchMessages () {
    Patcher.before(...MessageHeader, (self, [{ decorations, message }]) => {
      if (!decorations || typeof decorations[1] !== 'object' || !'length' in decorations[1]) return

      decorations[1].unshift(
        React.createElement(InVoiceTag, { user: message.author })
      )
    })
  }

  patchBotTags () {
    Patcher.after(...BotTag, (self, _, value) => {
      if (!value?.props?.className?.includes(UNIQUE_TAG)) return

      const TagContainer = findInReactTree(value, e => e.children?.some(c => typeof c?.props?.children === 'string'))

      TagContainer.children.find(c => typeof c?.props?.children === 'string').props.children = this.settings.text.toUpperCase()
      TagContainer.children.unshift(this.buildInVoiceIcon())
    })
  }

  buildInVoiceIcon () {
    return React.createElement(
      'svg',
      {
        className: Selectors.BotTag.botTagVerified,
        width: 16,
        height: 16,
        viewBox: '0 0 28 28',
        style: {
          position: 'relative',
          top: '1px',
          left: '1px',
          marginRight: '1px'
        }
      },
      React.createElement('path', {
        fill: 'currentColor',
        d: 'M3 10v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71V6.41c0-.89-1.08-1.34-1.71-.71L7 9H4c-.55 0-1 .45-1 1zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 4.45v.2c0 .38.25.71.6.85C17.18 6.53 19 9.06 19 12s-1.82 5.47-4.4 6.5c-.36.14-.6.47-.6.85v.2c0 .63.63 1.07 1.21.85C18.6 19.11 21 15.84 21 12s-2.4-7.11-5.79-8.4c-.58-.23-1.21.22-1.21.85z'
      })
    )
  }

  stop () {
    Patcher.unpatchAll()
  }

  constructor () {
    this.defaultSettings = {
      text: 'In voice'
    }

    this.settings = this.loadSettings(this.defaultSettings)

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
    return UI.buildSettingsPanel({
      onChange: () => this.saveSettings(),
      settings: [
        {
          type: 'text',
          id: 'text',
          name: 'Tag Text',
          note: 'Sets up tag\'s text near user\'s name.',
          value: this.settings.text,
          onChange: e => this.settings.text = e
        }
      ]
    })
  }
}
