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
    "description": "A respectful bow: the character leans forward from the waist, briefly holds the pose, then returns upright.",
    "glyph": "⌄",
    "art": "emote",
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
    const artwork = item.id === "bow-emote"
      ? '<div class="emote-card-model bow-card-model" role="img" aria-label="Minecraft character performing a respectful bow"><span class="bow-card-upper"><span class="emote-card-head"></span><span class="emote-card-body"></span><span class="emote-card-arm-left"></span><span class="emote-card-arm-right"></span></span><span class="emote-card-leg-left"></span><span class="emote-card-leg-right"></span></div>'
      : item.id === "wave-emote"
        ? '<div class="emote-card-model wave-card-model" role="img" aria-label="MsAlexTsuki Minecraft character performing the Wave Emote"><span class="wave-card-upper"><span class="emote-card-head"></span><span class="emote-card-body"></span><span class="emote-card-arm-left"></span><span class="emote-card-arm-right"></span></span><span class="emote-card-leg-left"></span><span class="emote-card-leg-right"></span></div>'
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
  document.querySelector(".player-preview-label").textContent = item.category === "nametags" ? "NAMEPLATE PREVIEW" : item.id === "spark-effect" ? "WALKING EFFECT PREVIEW" : item.id === "bow-emote" ? "BOW EMOTE PREVIEW" : "PLAYER PREVIEW";
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
