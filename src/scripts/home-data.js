const htbProfileUrl = "https://labs.hackthebox.com/api/v4/profile/2706826";
const htbExperienceUrl = "https://labs.hackthebox.com/api/experience/v1/account/9fd9101d-2a74-4834-b63c-20b009a7cbcf";
const thmApiUrl = "https://tryhackme.com/api/v2/public-profile?username=BotNas";
const thmProfileUrl = "https://tryhackme.com/p/BotNas";
const ctftimeProfileUrl = "https://ctftime.org/team/436924";

export const githubProfileUrl = "https://github.com/AllanzoDaizen";
export const linkedinProfileUrl = "https://www.linkedin.com/in/sok-sovannara-68478632b/";

const fallbackHtb = {
  profile: {
    name: "BotNas",
    rank: "Elite Hacker",
    ranking: 306,
    countryRank: null,
    country_name: "Cambodia",
    country_code: "KH",
    avatar: "https://htb-sso-prod-public-storage.s3.eu-central-1.amazonaws.com/users/ae709eb4-10cf-473c-9fe4-225cdc40bf0f-avatar.png"
  },
  experience: {
    level: 66,
    levelTitle: "Master",
    rankImage: "https://htb-experience-prod-public-storage.s3.amazonaws.com/assets/ranks/svg/rank_master.svg",
    rankImageBackground: "https://htb-experience-prod-public-storage.s3.amazonaws.com/assets/ranks/backgrounds/master.svg"
  }
};

const fallbackThm = {
  username: "BotNas",
  level: 14,
  title: "Guardian",
  country: "kh",
  about: "Emm sne kob sarii Zin2 BCZIN",
  rank: 8555,
  countryRank: null,
  topPercentage: 1,
  leagueTier: "bronze",
  totalPoints: 36335,
  capabilityScore: 84.94082881074738,
  capabilityPov: "red",
  avatar: "https://cdn-images.tryhackme.com/user-avatars/66ea42f4b16a8e4ff63a5b04-1784262668536",
  badgeImageURL: "https://tryhackme-badges.s3.amazonaws.com/BotNas.png",
  rooms: 196,
  badges: 23,
  streak: null,
  tags: ["Top 1%", "Bronze", "Red POV"],
  profileUrl: thmProfileUrl
};

const fallbackCtftime = {
  team: "WillHack4Coffee",
  type: "Academic team",
  tagline: "99% coffee, 1% luck.",
  country: "KH",
  overallPlace: 744,
  countryPlace: 2,
  avatar: "https://ctftime.org/media/cache/85/27/852787c2b98a7c5267c3af6bdbc86b2e.png",
  profileUrl: ctftimeProfileUrl
};

export const certifications = [
  {
    id: "cc",
    shortName: "CC",
    issuer: "ISC2",
    title: "Certified in Cybersecurity (CC)",
    description: "Entry-level cybersecurity certification covering security principles, access controls, network security, and incident response fundamentals.",
    link: "https://www.credly.com/badges/a2725f4c-674a-46bd-8e50-43421e683892/public_url",
    detail: "Builds a baseline across core security concepts: identity and access, network defense, risk, operations, and incident response.",
    image: "/images/cert-cc-preview.jpg"
  },
  {
    id: "csedp",
    shortName: "CSEDP",
    issuer: "The SecOps Group",
    title: "Certified Social Engineering Defense Practitioner (CSEDP)",
    description: "Social engineering defense certification focused on recognizing human-targeted attacks, reducing manipulation risk, and strengthening user awareness.",
    link: "https://candidate.speedexam.net/certificate.aspx?SSTATE=am4131EniU8ntjp4bO5mXX7szqw7FQvvF307txF%2F1sZ6f00bplBIyaqmG1UW%2FRBlA0nKV2wWyUMn3GhUvxp9d4%2BsJnIItCs7LT4195C50tU%3D",
    detail: "Passed with Merit, validating practical understanding of social engineering attack patterns and defensive awareness controls.",
    image: "/images/cert-csedp-preview.jpg"
  },
  {
    id: "crta",
    shortName: "CRTA",
    issuer: "Cyberwarfare Labs",
    title: "Certified Red Team Analyst (CRTA)",
    description: "Practical red team certification covering enterprise attack paths, AD, pivoting, and MITRE ATT&CK methodology.",
    link: "https://labs.cyberwarfare.live/credential/achievement/68b7c90640a4bd67bdc82739",
    detail: "Covers reconnaissance, Kerberos-based attacks, lateral movement, segmented network pivoting, and red team methodology in enterprise environments.",
    image: "/images/cert-crta-preview.jpg"
  },
  {
    id: "cscrb",
    shortName: "CSCRB",
    issuer: "RedTeam Leaders",
    title: "Certified Security Code Review Beginners (CSCRB)",
    description: "Security code review certification focused on finding vulnerabilities through source analysis.",
    link: "https://courses.redteamleaders.com/exam-completion/84d56eab86b5f7c9",
    detail: "Focuses on reviewing application code paths, spotting risky patterns, and documenting vulnerabilities from source-level evidence.",
    image: "/images/cert-cscrb-preview.jpg"
  }
];

export const formatRank = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  return `#${Number.isFinite(numericValue) ? numericValue.toLocaleString() : value}`;
};

async function fetchJson(url, referer = "https://app.hackthebox.com/") {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Referer: referer,
      "User-Agent": "Mozilla/5.0 Portfolio Astro profile sync"
    }
  });

  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`GET ${url} did not return JSON`);
  }
}

async function fetchText(url, referer = "https://ctftime.org/") {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "text/html",
      Referer: referer,
      "User-Agent": "Mozilla/5.0 Portfolio Astro profile sync"
    }
  });

  if (!response.ok) {
    throw new Error(`GET ${url} failed with ${response.status}`);
  }

  return response.text();
}

function stripHtml(value) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCtftimeTeam(html) {
  const heading = html.match(/<h2[^>]*>[\s\S]*?<\/h2>/i)?.[0] ?? "";
  const type = html.match(/<strong>([^<]*team)<\/strong>/i)?.[1];
  const tagline = html.match(/<p>\s*([^<]*coffee[^<]*)\s*<\/p>/i)?.[1];
  const overall = html.match(/Overall rating place:\s*<strong>(\d+)<\/strong>/i)?.[1];
  const country = html.match(/Country place:\s*<strong>\s*<a[^>]*>(\d+)<\/a>/i)?.[1]
    ?? html.match(/Country place:\s*<strong>(\d+)<\/strong>/i)?.[1];
  const avatar = html.match(/<img\s+src="([^"]*\/media\/cache\/[^"]+)"\s+width="150"\s+height="150"/i)?.[1];

  return {
    ...fallbackCtftime,
    team: stripHtml(heading).replace(/^KH\s+/i, "") || fallbackCtftime.team,
    type: type ?? fallbackCtftime.type,
    tagline: tagline ?? fallbackCtftime.tagline,
    overallPlace: overall ? Number(overall) : fallbackCtftime.overallPlace,
    countryPlace: country ? Number(country) : fallbackCtftime.countryPlace,
    avatar: avatar ? new URL(avatar, ctftimeProfileUrl).href : fallbackCtftime.avatar
  };
}

function normalizeThmProfile(raw) {
  const source = raw?.data ?? raw?.profile ?? raw?.user ?? raw ?? {};
  const stats = source.stats ?? source.statistics ?? source;
  const badges = Array.isArray(source.badges) ? source.badges.length : stats.badges;

  return {
    username: source.username ?? source.name ?? fallbackThm.username,
    level: source.level ?? fallbackThm.level,
    title: source.title ?? source.rankTitle ?? source.levelTitle ?? fallbackThm.title,
    country: source.country ?? fallbackThm.country,
    about: source.about ?? fallbackThm.about,
    rank: source.rank ?? fallbackThm.rank,
    countryRank: source.countryRank ?? source.country_rank ?? source.countryRanking ?? source.country_ranking ?? fallbackThm.countryRank,
    topPercentage: source.topPercentage ?? fallbackThm.topPercentage,
    leagueTier: source.leagueTier ?? fallbackThm.leagueTier,
    totalPoints: source.totalPoints ?? stats.points ?? fallbackThm.totalPoints,
    capabilityScore: source.capabilityScore?.value ?? fallbackThm.capabilityScore,
    capabilityPov: source.capabilityScore?.pov ?? fallbackThm.capabilityPov,
    avatar: source.avatar ?? source.avatarUrl ?? source.image ?? "",
    badgeImageURL: source.badgeImageURL ?? fallbackThm.badgeImageURL,
    rooms: source.completedRoomsNumber ?? stats.roomsCompleted ?? stats.completedRooms ?? stats.rooms ?? null,
    badges: source.badgesNumber ?? badges ?? stats.badgeCount ?? null,
    streak: stats.streak ?? stats.currentStreak ?? stats.streakDays ?? null,
    tags: fallbackThm.tags,
    profileUrl: thmProfileUrl
  };
}

export async function getHomeProfileData() {
  let htb = fallbackHtb;
  let thm = fallbackThm;
  let ctftime = fallbackCtftime;

  try {
    const [profileData, experience] = await Promise.all([
      fetchJson(htbProfileUrl),
      fetchJson(htbExperienceUrl)
    ]);

    htb = {
      profile: profileData.profile ?? fallbackHtb.profile,
      experience: experience ?? fallbackHtb.experience
    };
  } catch (error) {
    console.warn(`HTB fetch failed, rendering fallback data: ${error.message}`);
  }

  try {
    thm = normalizeThmProfile(await fetchJson(thmApiUrl, "https://tryhackme.com/"));
  } catch (error) {
    console.warn(`TryHackMe fetch failed, rendering fallback data: ${error.message}`);
  }

  try {
    ctftime = normalizeCtftimeTeam(await fetchText(ctftimeProfileUrl));
  } catch (error) {
    console.warn(`CTFTime fetch failed, rendering fallback data: ${error.message}`);
  }

  return { htb, thm, ctftime };
}
