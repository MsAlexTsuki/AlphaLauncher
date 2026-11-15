const products = [
  {id:"aurora-cape",name:"Aurora Cape",category:"capes",label:"CAPE",description:"A clean gold-accented cape concept for the Alpha collection, with no letter overlay.",glyph:"",art:"cape",badge:"FEATURED",owned:true},
  {id:"ember-cape",name:"Ember Cape",category:"capes",label:"CAPE",description:"A warm, ember-inspired cape concept with a bold golden glow.",glyph:"✦",art:"cape",badge:"PREVIEW",owned:false},
  {id:"wave-emote",sourceClass:"WaveEmote",name:"Wave Emote",category:"emotes",label:"EMOTE",description:"A simple greeting emote concept for player expression.",glyph:"↗",art:"emote",badge:"PREVIEW",owned:false},
  {id:"alpha-tag",name:"Alpha Nameplate",category:"nametags",label:"NAMETAG",description:"A distinctive Alpha-styled nameplate treatment designed to make a player name stand out.",glyph:"MsAlexTsuki",art:"name",badge:"COMMUNITY",owned:true},
  {id:"spark-effect",name:"Golden Spark",category:"effects",label:"EFFECT",description:"A golden movement trail that follows the player while walking or flying.",glyph:"✧",art:"effect",badge:"PREVIEW",owned:false},
  {id:"dark-ui",name:"Obsidian UI",category:"ui",label:"UI STYLE",description:"A dark interface accent concept for the Alpha experience.",glyph:"A",art:"ui",badge:"PREVIEW",owned:false},
  {
    "id": "alpha-badge-chat-cosmetic",
    "sourceClass": "AlphaBadgeChatCosmetic",
    "name": "Alpha Badge Chat Cosmetic",
    "category": "chat",
    "label": "CHAT",
    "description": "AlphaClient cosmetic component: Alpha Badge Chat Cosmetic.",
    "glyph": "✉",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "alpha-colored-name",
    "sourceClass": "AlphaColoredName",
    "name": "Alpha Colored Name",
    "category": "nametags",
    "label": "NAMETAG",
    "description": "AlphaClient cosmetic component: Alpha Colored Name.",
    "glyph": "Aa",
    "art": "name",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "alpha-cosmetics-core",
    "sourceClass": "AlphaCosmeticsCore",
    "name": "Alpha Cosmetics Core",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Alpha Cosmetics Core.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "alpha-logo-kill-effect",
    "sourceClass": "AlphaLogoKillEffect",
    "name": "Alpha Logo Kill Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Alpha Logo Kill Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "alpha-logo-victory-effect",
    "sourceClass": "AlphaLogoVictoryEffect",
    "name": "Alpha Logo Victory Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Alpha Logo Victory Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "alpha-particles-hit-effect",
    "sourceClass": "AlphaParticlesHitEffect",
    "name": "Alpha Particles Hit Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Alpha Particles Hit Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "alpha-trail",
    "sourceClass": "AlphaTrail",
    "name": "Alpha Trail",
    "category": "trails",
    "label": "TRAIL",
    "description": "AlphaClient cosmetic component: Alpha Trail.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "animated-name",
    "sourceClass": "AnimatedName",
    "name": "Animated Name",
    "category": "nametags",
    "label": "NAMETAG",
    "description": "AlphaClient cosmetic component: Animated Name.",
    "glyph": "Aa",
    "art": "name",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "animated-prefixes",
    "sourceClass": "AnimatedPrefixes",
    "name": "Animated Prefixes",
    "category": "nametags",
    "label": "NAMETAG",
    "description": "AlphaClient cosmetic component: Animated Prefixes.",
    "glyph": "Aa",
    "art": "name",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "animation-customizer",
    "sourceClass": "AnimationCustomizer",
    "name": "Animation Customizer",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Animation Customizer.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "big-name",
    "sourceClass": "BigName",
    "name": "Big Name",
    "category": "nametags",
    "label": "NAMETAG",
    "description": "AlphaClient cosmetic component: Big Name.",
    "glyph": "Aa",
    "art": "name",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "bow-emote",
    "sourceClass": "BowEmote",
    "name": "Bow Emote",
    "category": "emotes",
    "label": "EMOTE",
    "description": "AlphaClient cosmetic component: Bow Emote.",
    "glyph": "↗",
    "art": "emote",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cape-manager",
    "sourceClass": "CapeManager",
    "name": "Cape Manager",
    "category": "capes",
    "label": "CAPE",
    "description": "AlphaClient cosmetic component: Cape Manager.",
    "glyph": "✦",
    "art": "cape",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "capes",
    "sourceClass": "Capes",
    "name": "Capes",
    "category": "capes",
    "label": "CAPE",
    "description": "AlphaClient cosmetic component: Capes.",
    "glyph": "✦",
    "art": "cape",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "celebrate-emote",
    "sourceClass": "CelebrateEmote",
    "name": "Celebrate Emote",
    "category": "emotes",
    "label": "EMOTE",
    "description": "AlphaClient cosmetic component: Celebrate Emote.",
    "glyph": "↗",
    "art": "emote",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "chat-appearance-customization",
    "sourceClass": "ChatAppearanceCustomization",
    "name": "Chat Appearance Customization",
    "category": "chat",
    "label": "CHAT",
    "description": "AlphaClient cosmetic component: Chat Appearance Customization.",
    "glyph": "✉",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "chat-badges",
    "sourceClass": "ChatBadges",
    "name": "Chat Badges",
    "category": "chat",
    "label": "CHAT",
    "description": "AlphaClient cosmetic component: Chat Badges.",
    "glyph": "✉",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "chat-bubbles-above-player-heads",
    "sourceClass": "ChatBubblesAbovePlayerHeads",
    "name": "Chat Bubbles Above Player Heads",
    "category": "chat",
    "label": "CHAT",
    "description": "AlphaClient cosmetic component: Chat Bubbles Above Player Heads.",
    "glyph": "✉",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "coins-victory-effect",
    "sourceClass": "CoinsVictoryEffect",
    "name": "Coins Victory Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Coins Victory Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "combo-particles-hit-effect",
    "sourceClass": "ComboParticlesHitEffect",
    "name": "Combo Particles Hit Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Combo Particles Hit Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "confetti-kill-effect",
    "sourceClass": "ConfettiKillEffect",
    "name": "Confetti Kill Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Confetti Kill Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "confetti-victory-effect",
    "sourceClass": "ConfettiVictoryEffect",
    "name": "Confetti Victory Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Confetti Victory Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-asset-management",
    "sourceClass": "CosmeticAssetManagement",
    "name": "Cosmetic Asset Management",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Asset Management.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-audit-history",
    "sourceClass": "CosmeticAuditHistory",
    "name": "Cosmetic Audit History",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Audit History.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-bundles",
    "sourceClass": "CosmeticBundles",
    "name": "Cosmetic Bundles",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Bundles.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-coin-shop",
    "sourceClass": "CosmeticCoinShop",
    "name": "Cosmetic Coin Shop",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Coin Shop.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-collection-screen",
    "sourceClass": "CosmeticCollectionScreen",
    "name": "Cosmetic Collection Screen",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Collection Screen.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-database",
    "sourceClass": "CosmeticDatabase",
    "name": "Cosmetic Database",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Database.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-loadouts",
    "sourceClass": "CosmeticLoadouts",
    "name": "Cosmetic Loadouts",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Loadouts.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-manager",
    "sourceClass": "CosmeticManager",
    "name": "Cosmetic Manager",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Manager.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-mixer",
    "sourceClass": "CosmeticMixer",
    "name": "Cosmetic Mixer",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Mixer.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-mystery-boxes",
    "sourceClass": "CosmeticMysteryBoxes",
    "name": "Cosmetic Mystery Boxes",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Mystery Boxes.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-performance-settings",
    "sourceClass": "CosmeticPerformanceSettings",
    "name": "Cosmetic Performance Settings",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Performance Settings.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-pets-lobby",
    "sourceClass": "CosmeticPetsLobby",
    "name": "Cosmetic Pets Lobby",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Pets Lobby.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-preview",
    "sourceClass": "CosmeticPreview",
    "name": "Cosmetic Preview",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Preview.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-security",
    "sourceClass": "CosmeticSecurity",
    "name": "Cosmetic Security",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Security.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-set-synergy",
    "sourceClass": "CosmeticSetSynergy",
    "name": "Cosmetic Set Synergy",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Set Synergy.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-shop-preview",
    "sourceClass": "CosmeticShopPreview",
    "name": "Cosmetic Shop Preview",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Shop Preview.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-store",
    "sourceClass": "CosmeticStore",
    "name": "Cosmetic Store",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Store.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-visibility",
    "sourceClass": "CosmeticVisibility",
    "name": "Cosmetic Visibility",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Visibility.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cosmetic-visibility-settings",
    "sourceClass": "CosmeticVisibilitySettings",
    "name": "Cosmetic Visibility Settings",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Cosmetic Visibility Settings.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "creator-badge-chat-cosmetic",
    "sourceClass": "CreatorBadgeChatCosmetic",
    "name": "Creator Badge Chat Cosmetic",
    "category": "chat",
    "label": "CHAT",
    "description": "AlphaClient cosmetic component: Creator Badge Chat Cosmetic.",
    "glyph": "✉",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "critical-particles-hit-effect",
    "sourceClass": "CriticalParticlesHitEffect",
    "name": "Critical Particles Hit Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Critical Particles Hit Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cross-arms-emote",
    "sourceClass": "CrossArmsEmote",
    "name": "Cross Arms Emote",
    "category": "emotes",
    "label": "EMOTE",
    "description": "AlphaClient cosmetic component: Cross Arms Emote.",
    "glyph": "↗",
    "art": "emote",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "crown-victory-effect",
    "sourceClass": "CrownVictoryEffect",
    "name": "Crown Victory Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Crown Victory Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "cursor-skins",
    "sourceClass": "CursorSkins",
    "name": "Cursor Skins",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Cursor Skins.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "custom-crosshair-manager",
    "sourceClass": "CustomCrosshairManager",
    "name": "Custom Crosshair Manager",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Custom Crosshair Manager.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "custom-grass-and-foliage-colors",
    "sourceClass": "CustomGrassAndFoliageColors",
    "name": "Custom Grass And Foliage Colors",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Custom Grass And Foliage Colors.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "custom-hotbar-skin",
    "sourceClass": "CustomHotbarSkin",
    "name": "Custom Hotbar Skin",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Custom Hotbar Skin.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "custom-hud-font",
    "sourceClass": "CustomHudFont",
    "name": "Custom Hud Font",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Custom Hud Font.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "custom-loading-screens",
    "sourceClass": "CustomLoadingScreens",
    "name": "Custom Loading Screens",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Custom Loading Screens.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "custom-menu-button-styles",
    "sourceClass": "CustomMenuButtonStyles",
    "name": "Custom Menu Button Styles",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Custom Menu Button Styles.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "custom-menu-sounds",
    "sourceClass": "CustomMenuSounds",
    "name": "Custom Menu Sounds",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Custom Menu Sounds.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "custom-menu-soundscape",
    "sourceClass": "CustomMenuSoundscape",
    "name": "Custom Menu Soundscape",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Custom Menu Soundscape.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "custom-nametag-backgrounds-animations",
    "sourceClass": "CustomNametagBackgroundsAnimations",
    "name": "Custom Nametag Backgrounds Animations",
    "category": "nametags",
    "label": "NAMETAG",
    "description": "AlphaClient cosmetic component: Custom Nametag Backgrounds Animations.",
    "glyph": "Aa",
    "art": "name",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "custom-profile-banners",
    "sourceClass": "CustomProfileBanners",
    "name": "Custom Profile Banners",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Custom Profile Banners.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "custom-rain-snow-particles",
    "sourceClass": "CustomRainSnowParticles",
    "name": "Custom Rain Snow Particles",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Custom Rain Snow Particles.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "custom-sky-and-stars",
    "sourceClass": "CustomSkyAndStars",
    "name": "Custom Sky And Stars",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Custom Sky And Stars.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "custom-weather-particles",
    "sourceClass": "CustomWeatherParticles",
    "name": "Custom Weather Particles",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Custom Weather Particles.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "custom-xp-bar-color",
    "sourceClass": "CustomXpBarColor",
    "name": "Custom Xp Bar Color",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Custom Xp Bar Color.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "dab-emote",
    "sourceClass": "DabEmote",
    "name": "Dab Emote",
    "category": "emotes",
    "label": "EMOTE",
    "description": "AlphaClient cosmetic component: Dab Emote.",
    "glyph": "↗",
    "art": "emote",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "dance-emote",
    "sourceClass": "DanceEmote",
    "name": "Dance Emote",
    "category": "emotes",
    "label": "EMOTE",
    "description": "AlphaClient cosmetic component: Dance Emote.",
    "glyph": "↗",
    "art": "emote",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "developer-badge-chat-cosmetic",
    "sourceClass": "DeveloperBadgeChatCosmetic",
    "name": "Developer Badge Chat Cosmetic",
    "category": "chat",
    "label": "CHAT",
    "description": "AlphaClient cosmetic component: Developer Badge Chat Cosmetic.",
    "glyph": "✉",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "early-supporter-badge",
    "sourceClass": "EarlySupporterBadge",
    "name": "Early Supporter Badge",
    "category": "chat",
    "label": "CHAT",
    "description": "AlphaClient cosmetic component: Early Supporter Badge.",
    "glyph": "✉",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "emote-manager",
    "sourceClass": "EmoteManager",
    "name": "Emote Manager",
    "category": "emotes",
    "label": "EMOTE",
    "description": "AlphaClient cosmetic component: Emote Manager.",
    "glyph": "↗",
    "art": "emote",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "emote-wheel",
    "sourceClass": "EmoteWheel",
    "name": "Emote Wheel",
    "category": "emotes",
    "label": "EMOTE",
    "description": "AlphaClient cosmetic component: Emote Wheel.",
    "glyph": "↗",
    "art": "emote",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "emote-wheel-customization",
    "sourceClass": "EmoteWheelCustomization",
    "name": "Emote Wheel Customization",
    "category": "emotes",
    "label": "EMOTE",
    "description": "AlphaClient cosmetic component: Emote Wheel Customization.",
    "glyph": "↗",
    "art": "emote",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "energy-burst-victory-effect",
    "sourceClass": "EnergyBurstVictoryEffect",
    "name": "Energy Burst Victory Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Energy Burst Victory Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "energy-trail",
    "sourceClass": "EnergyTrail",
    "name": "Energy Trail",
    "category": "trails",
    "label": "TRAIL",
    "description": "AlphaClient cosmetic component: Energy Trail.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "explosion-victory-effect",
    "sourceClass": "ExplosionVictoryEffect",
    "name": "Explosion Victory Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Explosion Victory Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "fire-trail",
    "sourceClass": "FireTrail",
    "name": "Fire Trail",
    "category": "trails",
    "label": "TRAIL",
    "description": "AlphaClient cosmetic component: Fire Trail.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "fireworks-victory-effect",
    "sourceClass": "FireworksVictoryEffect",
    "name": "Fireworks Victory Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Fireworks Victory Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "founder-badge-chat-cosmetic",
    "sourceClass": "FounderBadgeChatCosmetic",
    "name": "Founder Badge Chat Cosmetic",
    "category": "chat",
    "label": "CHAT",
    "description": "AlphaClient cosmetic component: Founder Badge Chat Cosmetic.",
    "glyph": "✉",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "friend-nametag-colors",
    "sourceClass": "FriendNametagColors",
    "name": "Friend Nametag Colors",
    "category": "nametags",
    "label": "NAMETAG",
    "description": "AlphaClient cosmetic component: Friend Nametag Colors.",
    "glyph": "Aa",
    "art": "name",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "friend-nametags",
    "sourceClass": "FriendNametags",
    "name": "Friend Nametags",
    "category": "nametags",
    "label": "NAMETAG",
    "description": "AlphaClient cosmetic component: Friend Nametags.",
    "glyph": "Aa",
    "art": "name",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "friends-cosmetic-integration",
    "sourceClass": "FriendsCosmeticIntegration",
    "name": "Friends Cosmetic Integration",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Friends Cosmetic Integration.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "glow-name",
    "sourceClass": "GlowName",
    "name": "Glow Name",
    "category": "nametags",
    "label": "NAMETAG",
    "description": "AlphaClient cosmetic component: Glow Name.",
    "glyph": "Aa",
    "art": "name",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "gradient-name",
    "sourceClass": "GradientName",
    "name": "Gradient Name",
    "category": "nametags",
    "label": "NAMETAG",
    "description": "AlphaClient cosmetic component: Gradient Name.",
    "glyph": "Aa",
    "art": "name",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "heart-trail",
    "sourceClass": "HeartTrail",
    "name": "Heart Trail",
    "category": "trails",
    "label": "TRAIL",
    "description": "AlphaClient cosmetic component: Heart Trail.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "laugh-emote",
    "sourceClass": "LaughEmote",
    "name": "Laugh Emote",
    "category": "emotes",
    "label": "EMOTE",
    "description": "AlphaClient cosmetic component: Laugh Emote.",
    "glyph": "↗",
    "art": "emote",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "launcher-cosmetic-integration",
    "sourceClass": "LauncherCosmeticIntegration",
    "name": "Launcher Cosmetic Integration",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Launcher Cosmetic Integration.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "lightning-trail",
    "sourceClass": "LightningTrail",
    "name": "Lightning Trail",
    "category": "trails",
    "label": "TRAIL",
    "description": "AlphaClient cosmetic component: Lightning Trail.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "lightning-victory-effect",
    "sourceClass": "LightningVictoryEffect",
    "name": "Lightning Victory Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Lightning Victory Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "limited-cosmetics-system",
    "sourceClass": "LimitedCosmeticsSystem",
    "name": "Limited Cosmetics System",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Limited Cosmetics System.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "limited-time-event-badges",
    "sourceClass": "LimitedTimeEventBadges",
    "name": "Limited Time Event Badges",
    "category": "chat",
    "label": "CHAT",
    "description": "AlphaClient cosmetic component: Limited Time Event Badges.",
    "glyph": "✉",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "linked-account-verification-badge",
    "sourceClass": "LinkedAccountVerificationBadge",
    "name": "Linked Account Verification Badge",
    "category": "chat",
    "label": "CHAT",
    "description": "AlphaClient cosmetic component: Linked Account Verification Badge.",
    "glyph": "✉",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "local-skin-preview-switcher",
    "sourceClass": "LocalSkinPreviewSwitcher",
    "name": "Local Skin Preview Switcher",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Local Skin Preview Switcher.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "menu-opening-animations",
    "sourceClass": "MenuOpeningAnimations",
    "name": "Menu Opening Animations",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Menu Opening Animations.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "mouse-trail",
    "sourceClass": "MouseTrail",
    "name": "Mouse Trail",
    "category": "trails",
    "label": "TRAIL",
    "description": "AlphaClient cosmetic component: Mouse Trail.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "multiple-achievement-badges",
    "sourceClass": "MultipleAchievementBadges",
    "name": "Multiple Achievement Badges",
    "category": "chat",
    "label": "CHAT",
    "description": "AlphaClient cosmetic component: Multiple Achievement Badges.",
    "glyph": "✉",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "name-tag-customizer",
    "sourceClass": "NameTagCustomizer",
    "name": "Name Tag Customizer",
    "category": "nametags",
    "label": "NAMETAG",
    "description": "AlphaClient cosmetic component: Name Tag Customizer.",
    "glyph": "Aa",
    "art": "name",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "owner-emote-pack",
    "sourceClass": "OwnerEmotePack",
    "name": "Owner Emote Pack",
    "category": "emotes",
    "label": "EMOTE",
    "description": "AlphaClient cosmetic component: Owner Emote Pack.",
    "glyph": "↗",
    "art": "emote",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "particle-customizer",
    "sourceClass": "ParticleCustomizer",
    "name": "Particle Customizer",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Particle Customizer.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "pixel-explosion-kill-effect",
    "sourceClass": "PixelExplosionKillEffect",
    "name": "Pixel Explosion Kill Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Pixel Explosion Kill Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "pixel-trail",
    "sourceClass": "PixelTrail",
    "name": "Pixel Trail",
    "category": "trails",
    "label": "TRAIL",
    "description": "AlphaClient cosmetic component: Pixel Trail.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "point-emote",
    "sourceClass": "PointEmote",
    "name": "Point Emote",
    "category": "emotes",
    "label": "EMOTE",
    "description": "AlphaClient cosmetic component: Point Emote.",
    "glyph": "↗",
    "art": "emote",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "portal-victory-effect",
    "sourceClass": "PortalVictoryEffect",
    "name": "Portal Victory Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Portal Victory Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "premium-badge-chat-cosmetic",
    "sourceClass": "PremiumBadgeChatCosmetic",
    "name": "Premium Badge Chat Cosmetic",
    "category": "chat",
    "label": "CHAT",
    "description": "AlphaClient cosmetic component: Premium Badge Chat Cosmetic.",
    "glyph": "✉",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "radial-emote-menu",
    "sourceClass": "RadialEmoteMenu",
    "name": "Radial Emote Menu",
    "category": "emotes",
    "label": "EMOTE",
    "description": "AlphaClient cosmetic component: Radial Emote Menu.",
    "glyph": "↗",
    "art": "emote",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "rainbow-name",
    "sourceClass": "RainbowName",
    "name": "Rainbow Name",
    "category": "nametags",
    "label": "NAMETAG",
    "description": "AlphaClient cosmetic component: Rainbow Name.",
    "glyph": "Aa",
    "art": "name",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "rainbow-nametag-for-yourself",
    "sourceClass": "RainbowNametagForYourself",
    "name": "Rainbow Nametag For Yourself",
    "category": "nametags",
    "label": "NAMETAG",
    "description": "AlphaClient cosmetic component: Rainbow Nametag For Yourself.",
    "glyph": "Aa",
    "art": "name",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "rainbow-trail",
    "sourceClass": "RainbowTrail",
    "name": "Rainbow Trail",
    "category": "trails",
    "label": "TRAIL",
    "description": "AlphaClient cosmetic component: Rainbow Trail.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "rank-based-cosmetics",
    "sourceClass": "RankBasedCosmetics",
    "name": "Rank Based Cosmetics",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Rank Based Cosmetics.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "rotating-skin-preview-in-menus",
    "sourceClass": "RotatingSkinPreviewInMenus",
    "name": "Rotating Skin Preview In Menus",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Rotating Skin Preview In Menus.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "salute-emote",
    "sourceClass": "SaluteEmote",
    "name": "Salute Emote",
    "category": "emotes",
    "label": "EMOTE",
    "description": "AlphaClient cosmetic component: Salute Emote.",
    "glyph": "↗",
    "art": "emote",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "screenshot-filters",
    "sourceClass": "ScreenshotFilters",
    "name": "Screenshot Filters",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Screenshot Filters.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "selectable-main-menu-backgrounds",
    "sourceClass": "SelectableMainMenuBackgrounds",
    "name": "Selectable Main Menu Backgrounds",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Selectable Main Menu Backgrounds.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "silent-notification-skin",
    "sourceClass": "SilentNotificationSkin",
    "name": "Silent Notification Skin",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Silent Notification Skin.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "sit-emote",
    "sourceClass": "SitEmote",
    "name": "Sit Emote",
    "category": "emotes",
    "label": "EMOTE",
    "description": "AlphaClient cosmetic component: Sit Emote.",
    "glyph": "↗",
    "art": "emote",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "skin-layer-toggle",
    "sourceClass": "SkinLayerToggle",
    "name": "Skin Layer Toggle",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Skin Layer Toggle.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "skin-manager",
    "sourceClass": "SkinManager",
    "name": "Skin Manager",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Skin Manager.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "smoke-kill-effect",
    "sourceClass": "SmokeKillEffect",
    "name": "Smoke Kill Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Smoke Kill Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "smoke-trail",
    "sourceClass": "SmokeTrail",
    "name": "Smoke Trail",
    "category": "trails",
    "label": "TRAIL",
    "description": "AlphaClient cosmetic component: Smoke Trail.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "social-badge-showcase",
    "sourceClass": "SocialBadgeShowcase",
    "name": "Social Badge Showcase",
    "category": "chat",
    "label": "CHAT",
    "description": "AlphaClient cosmetic component: Social Badge Showcase.",
    "glyph": "✉",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "soul-kill-effect",
    "sourceClass": "SoulKillEffect",
    "name": "Soul Kill Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Soul Kill Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "spotify-now-playing-badge",
    "sourceClass": "SpotifyNowPlayingBadge",
    "name": "Spotify Now Playing Badge",
    "category": "chat",
    "label": "CHAT",
    "description": "AlphaClient cosmetic component: Spotify Now Playing Badge.",
    "glyph": "✉",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "staff-badge-chat-cosmetic",
    "sourceClass": "StaffBadgeChatCosmetic",
    "name": "Staff Badge Chat Cosmetic",
    "category": "chat",
    "label": "CHAT",
    "description": "AlphaClient cosmetic component: Staff Badge Chat Cosmetic.",
    "glyph": "✉",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "star-trail",
    "sourceClass": "StarTrail",
    "name": "Star Trail",
    "category": "trails",
    "label": "TRAIL",
    "description": "AlphaClient cosmetic component: Star Trail.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "stars-victory-effect",
    "sourceClass": "StarsVictoryEffect",
    "name": "Stars Victory Effect",
    "category": "effects",
    "label": "EFFECT",
    "description": "AlphaClient cosmetic component: Stars Victory Effect.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "swing-animation-speed",
    "sourceClass": "SwingAnimationSpeed",
    "name": "Swing Animation Speed",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Swing Animation Speed.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "three-dskins",
    "sourceClass": "ThreeDSkins",
    "name": "Three DSkins",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Three DSkins.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "trail-effects",
    "sourceClass": "TrailEffects",
    "name": "Trail Effects",
    "category": "trails",
    "label": "TRAIL",
    "description": "AlphaClient cosmetic component: Trail Effects.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "unlockable-gradient-colored-names",
    "sourceClass": "UnlockableGradientColoredNames",
    "name": "Unlockable Gradient Colored Names",
    "category": "nametags",
    "label": "NAMETAG",
    "description": "AlphaClient cosmetic component: Unlockable Gradient Colored Names.",
    "glyph": "Aa",
    "art": "name",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "unlockable-hotbar-skins",
    "sourceClass": "UnlockableHotbarSkins",
    "name": "Unlockable Hotbar Skins",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Unlockable Hotbar Skins.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "viewmodel-customizer",
    "sourceClass": "ViewmodelCustomizer",
    "name": "Viewmodel Customizer",
    "category": "ui",
    "label": "UI STYLE",
    "description": "AlphaClient cosmetic component: Viewmodel Customizer.",
    "glyph": "A",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "void-trail",
    "sourceClass": "VoidTrail",
    "name": "Void Trail",
    "category": "trails",
    "label": "TRAIL",
    "description": "AlphaClient cosmetic component: Void Trail.",
    "glyph": "✧",
    "art": "effect",
    "badge": "ALPHA CLIENT",
    "owned": false
  },
  {
    "id": "wings",
    "sourceClass": "Wings",
    "name": "Wings",
    "category": "other",
    "label": "COSMETIC",
    "description": "AlphaClient cosmetic component: Wings.",
    "glyph": "◇",
    "art": "ui",
    "badge": "ALPHA CLIENT",
    "owned": false
  }
];

const grid = document.getElementById("product-grid");
const searchInput = document.getElementById("search-input");
const emptyState = document.getElementById("empty-state");
const modal = document.getElementById("modal");
const filterRow = document.getElementById("filter-row");
const sortSelect = document.getElementById("sort-select");
const collectionNotice = document.getElementById("collection-notice");
const modalEquip = document.getElementById("modal-equip");
let activeCategory = "all";
let activeView = "discover";
let currentItemId = null;

const ownedItems = products.filter((item) => item.owned);
const collectionCount = document.getElementById("collection-count");
collectionCount.textContent = String(ownedItems.length);
const allItemsCount = document.getElementById("all-items-count");
if (allItemsCount) allItemsCount.textContent = String(products.length).padStart(2, "0");

function getEquippedId() {
  try {
    const saved = localStorage.getItem("alpha-store-demo-equipped");
    return ownedItems.some((item) => item.id === saved) ? saved : "aurora-cape";
  } catch {
    return "aurora-cape";
  }
}

let equippedId = getEquippedId();

function setEquippedId(id) {
  equippedId = equippedId === id ? null : id;
  try {
    if (equippedId) localStorage.setItem("alpha-store-demo-equipped", equippedId);
    else localStorage.removeItem("alpha-store-demo-equipped");
  } catch {
    // The prototype remains usable when browser storage is unavailable.
  }
  renderProducts();
  if (currentItemId) updateModalState(currentItemId);
}

function getVisibleProducts() {
  const query = searchInput.value.trim().toLowerCase();
  let visible = products.filter((item) => {
    const inView = activeView === "collection" ? item.owned : true;
    const categoryMatch = activeView === "collection" || activeCategory === "all" || item.category === activeCategory;
    const searchMatch = !query || [item.name, item.label, item.description, item.sourceClass || ""].join(" ").toLowerCase().includes(query);
    return inView && categoryMatch && searchMatch;
  });

  // In Discover, keep purchasable items first and move owned items to the bottom.
  // In My Collection, preserve the existing owned-only view.
  if (activeView === "discover") {
    visible.sort((a, b) => Number(a.owned) - Number(b.owned));
  }

  if (sortSelect.value === "name") {
    visible.sort((a, b) => {
      if (activeView === "discover" && a.owned !== b.owned) return Number(a.owned) - Number(b.owned);
      return a.name.localeCompare(b.name);
    });
  }
  if (sortSelect.value === "category") {
    visible.sort((a, b) => {
      if (activeView === "discover" && a.owned !== b.owned) return Number(a.owned) - Number(b.owned);
      return a.label.localeCompare(b.label) || a.name.localeCompare(b.name);
    });
  }
  return visible;
}

function renderProducts() {
  const visible = getVisibleProducts();
  grid.innerHTML = visible.map((item) => {
    const isEquipped = equippedId === item.id;
    const ownedMarkup = item.owned ? '<span class="owned-pill">OWNED</span>' : "";
    const status = item.owned
      ? (isEquipped ? '<span class="card-status equipped">Equipped</span>' : '<span class="card-status">In collection</span>')
      : '<span class="card-status">Preview item</span>';
    const artwork = item.id === "wave-emote"
      ? '<div class="emote-card-model" role="img" aria-label="Minecraft character performing the Wave Emote"><span class="emote-card-head"></span><span class="emote-card-body"></span><span class="emote-card-arm-left"></span><span class="emote-card-arm-right"></span><span class="emote-card-leg-left"></span><span class="emote-card-leg-right"></span></div>'
      : item.id === "spark-effect"
        ? '<div class="spark-card-scene" role="img" aria-label="Minecraft character walking away with a golden spark trail following directly behind"><span class="spark-card-trail" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="emote-card-model spark-card-model"><span class="emote-card-head"></span><span class="emote-card-body"></span><span class="emote-card-arm-left"></span><span class="emote-card-arm-right"></span><span class="emote-card-leg-left"></span><span class="emote-card-leg-right"></span></span></div>'
        : item.id === "alpha-tag"
        ? '<span class="nameplate-card-preview" role="img" aria-label="Alpha nameplate above player name"><span class="nameplate-card-badge">[Alpha]</span><span class="nameplate-card-name">MsAlexTsuki</span></span>'
        : `<span class="product-glyph">${item.glyph}</span>`;
    return `
      <article class="product-card ${item.owned ? "owned" : ""}" data-item="${item.id}" tabindex="0" role="button" aria-label="View ${item.name} details">
        <div class="product-art" data-art="${item.art}" data-item="${item.id}">
          <span class="product-badge">${item.badge}</span>${ownedMarkup}
          ${artwork}
        </div>
        <div class="product-meta">
          <div class="product-category">${item.label}</div>
          <h3 class="product-name">${item.name}</h3>
          <p class="product-desc">${item.description}</p>
          <div class="card-bottom">${status}<span class="preview-link">Details ↗</span></div>
        </div>
      </article>`;
  }).join("");

  const noResults = visible.length === 0;
  emptyState.hidden = !noResults;
  grid.hidden = noResults;
  document.getElementById("empty-title").textContent = activeView === "collection" ? "Your collection is empty" : "No cosmetics found";
  document.getElementById("empty-description").textContent = activeView === "collection"
    ? "Cosmetics assigned to your account will appear here."
    : "Try another search or category.";
}

function updateModalState(id) {
  const item = products.find((product) => product.id === id);
  if (!item) return;
  const isEquipped = equippedId === item.id;
  document.getElementById("modal-status").textContent = item.owned
    ? (isEquipped ? "Equipped in demo" : "Owned in demo")
    : "Preview only";
  modalEquip.hidden = !item.owned;
  modalEquip.textContent = isEquipped ? "Unequip cosmetic" : "Equip cosmetic";
  modalEquip.classList.toggle("is-equipped", isEquipped);
  document.getElementById("modal-note").textContent = item.sourceClass
    ? `AlphaClient source: ${item.sourceClass} · Store preview only`
    : item.owned
      ? "Local demo state · Not synced to an account"
      : "Preview item · Not available for purchase";
}

function openDetails(id) {
  const item = products.find((product) => product.id === id);
  if (!item) return;
  currentItemId = id;
  playerRotation = item.id === "spark-effect" ? 180 : 0;
  playerModel.style.transform = `rotateY(${playerRotation}deg)`;
  document.getElementById("modal-category").textContent = item.label;
  document.getElementById("modal-title").textContent = item.name;
  document.getElementById("modal-description").textContent = item.description;
  document.getElementById("modal-art").dataset.art = item.art;
  document.getElementById("modal-art").dataset.item = item.id;
  document.getElementById("player-cosmetic-mark").textContent = item.glyph;
  document.querySelector(".player-preview-label").textContent = item.category === "nametags" ? "NAMEPLATE PREVIEW" : item.id === "spark-effect" ? "WALKING EFFECT PREVIEW" : "PLAYER PREVIEW";
  document.getElementById("modal-badge").textContent = item.badge;
  document.getElementById("modal-type").textContent = item.label;
  updateModalState(id);
  modal.hidden = false;
  document.getElementById("modal-close").focus();
}

function setView(view) {
  activeView = view;
  document.querySelectorAll(".side-link").forEach((link) => link.classList.toggle("active", link.dataset.view === view));
  const inCollection = view === "collection";
  document.getElementById("section-title").textContent = inCollection ? "My collection" : "Featured cosmetics";
  document.getElementById("section-eyebrow").textContent = inCollection ? "YOUR ALPHA ITEMS" : "FIND YOUR STYLE";
  filterRow.hidden = inCollection;
  collectionNotice.hidden = !inCollection;
  sortSelect.value = "featured";
  if (!inCollection) {
    activeCategory = "all";
    document.querySelectorAll(".filter").forEach((filter) => filter.classList.toggle("active", filter.dataset.category === "all"));
  }
  renderProducts();
}

document.querySelectorAll(".filter").forEach((button) => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    document.querySelectorAll(".filter").forEach((filter) => filter.classList.toggle("active", filter === button));
    renderProducts();
  });
});

document.querySelectorAll(".side-link").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

grid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-item]");
  const previewButton = event.target.closest("[data-preview]");
  const id = previewButton ? previewButton.dataset.preview : card?.dataset.item;
  if (id) openDetails(id);
});

grid.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-item]")) {
    event.preventDefault();
    openDetails(event.target.dataset.item);
  }
});

searchInput.addEventListener("input", () => {
  if (activeView !== "discover") setView("discover");
  renderProducts();
});
sortSelect.addEventListener("change", renderProducts);

document.getElementById("clear-filters").addEventListener("click", () => {
  searchInput.value = "";
  activeCategory = "all";
  document.querySelectorAll(".filter").forEach((filter) => filter.classList.toggle("active", filter.dataset.category === "all"));
  if (activeView === "collection") setView("discover");
  else renderProducts();
});

document.getElementById("explore-button").addEventListener("click", () => {
  document.getElementById("catalogue").scrollIntoView({behavior:"smooth"});
  searchInput.focus({preventScroll:true});
});

modalEquip.addEventListener("click", () => {
  if (currentItemId) setEquippedId(currentItemId);
});
document.getElementById("modal-close").addEventListener("click", () => {
  modal.hidden = true;
  currentItemId = null;
});
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    modal.hidden = true;
    currentItemId = null;
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) {
    modal.hidden = true;
    currentItemId = null;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    searchInput.focus();
  }
});

renderProducts();


// Pointer-based horizontal drag rotation for the player preview.
const playerPreview = document.getElementById("modal-art");
const playerModel = document.getElementById("player-model");
let playerRotation = 0;
let dragStartX = 0;
let dragStartRotation = 0;
let activePointerId = null;

playerPreview.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 && event.pointerType === "mouse") return;
  if (modal.hidden) return;
  activePointerId = event.pointerId;
  dragStartX = event.clientX;
  dragStartRotation = playerRotation;
  playerPreview.classList.add("is-dragging");
  playerPreview.setPointerCapture(event.pointerId);
  event.preventDefault();
});

playerPreview.addEventListener("pointermove", (event) => {
  if (activePointerId !== event.pointerId) return;
  const horizontalDelta = event.clientX - dragStartX;
  playerRotation = dragStartRotation + horizontalDelta * 0.8;
  playerModel.style.transform = `rotateY(${playerRotation}deg)`;
});

function stopPlayerRotation(event) {
  if (activePointerId !== event.pointerId) return;
  activePointerId = null;
  playerPreview.classList.remove("is-dragging");
  if (playerPreview.hasPointerCapture(event.pointerId)) {
    playerPreview.releasePointerCapture(event.pointerId);
  }
}

playerPreview.addEventListener("pointerup", stopPlayerRotation);
playerPreview.addEventListener("pointercancel", stopPlayerRotation);
playerPreview.addEventListener("lostpointercapture", () => {
  activePointerId = null;
  playerPreview.classList.remove("is-dragging");
});
