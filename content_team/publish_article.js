// generateArticle()の結果を、SEOタグ込みの静的HTMLとして書き出し、
// 記事一覧(index.html)・サイトマップ・記事インデックス(data/articles.json)を
// 更新する。git commit・pushは別途手動(または依頼)で行う想定。
const fs = require("fs");
const path = require("path");
const { markdownToHtml } = require("./markdown");
const site = require("./site_config");

const DOCS_DIR = path.join(__dirname, "..", "docs");
const ARTICLES_DIR = path.join(DOCS_DIR, "articles");
const INDEX_DATA_FILE = path.join(__dirname, "..", "data", "articles.json");

// 新規記事は generate_article.js のトピック文言からキーワードで自動推定するが、
// 分類が合わない場合は data/articles.json の該当エントリの category を手動修正すればよい。
const CATEGORIES = [
  { key: "kihon", label: "① ラクヨコって何?" },
  { key: "fashion", label: "② ファッション" },
  { key: "gadget", label: "③ スマホ・雑貨" },
  { key: "interior", label: "④ インテリア・キッチン" },
  { key: "kaikata", label: "⑤ 買い方・お得情報" },
  { key: "trend", label: "⑥ トレンド・特集" },
];
const CATEGORY_KEYWORD_RULES = [
  { key: "fashion", words: ["ファッション", "コーデ", "服", "アクセサリー", "バッグ", "靴", "プチプラ服"] },
  { key: "gadget", words: ["スマホ", "スマホケース", "スマホアクセサリー", "ガジェット", "イヤホン"] },
  { key: "interior", words: ["インテリア", "キッチン", "雑貨", "収納", "お部屋", "生活雑貨"] },
  { key: "kaikata", words: ["送料", "注文単位", "買い方", "会員登録", "クーポン", "支払い", "配送", "返品"] },
  { key: "trend", words: ["トレンド", "特集", "今週", "新着", "話題", "SNS"] },
];
function inferCategory(article) {
  const text = `${article.title || ""} ${article.topic || ""}`;
  for (const rule of CATEGORY_KEYWORD_RULES) {
    if (rule.words.some((w) => text.includes(w))) return rule.key;
  }
  return "kihon";
}

function gaSnippet() {
  if (!site.googleAnalyticsId) return "";
  const id = site.googleAnalyticsId;
  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');</script>
`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readArticleIndex() {
  if (!fs.existsSync(INDEX_DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(INDEX_DATA_FILE, "utf8")).articles || [];
  } catch {
    return [];
  }
}

function writeArticleIndex(articles) {
  fs.mkdirSync(path.dirname(INDEX_DATA_FILE), { recursive: true });
  fs.writeFileSync(INDEX_DATA_FILE, JSON.stringify({ articles }, null, 2), "utf8");
}

// 生成環境(ローカルはJST、クラウドルーティンはUTC)に関わらず、必ず日本時間の
// 日付で表示するための変換。
function formatDateJa(iso) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}年${get("month")}月${get("day")}日`;
}

function relatedArticlesHtml(current, allArticles) {
  const others = allArticles.filter((a) => a.slug !== current.slug).slice(0, 3);
  if (others.length === 0) return "";
  return `
    <div class="article-disclaimer" style="background:transparent;">
      <strong>関連記事</strong>
      <ul>
        ${others.map((a) => `<li><a href="${escapeHtml(a.slug)}.html">${escapeHtml(a.title)}</a></li>`).join("")}
      </ul>
    </div>`;
}

function buildArticleHtml(article, allArticles) {
  const url = `${site.baseUrl}/articles/${article.slug}.html`;
  const bodyHtml = markdownToHtml(article.bodyMarkdown);
  const publishedIso = article.createdAt;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.meta,
    datePublished: publishedIso,
    dateModified: publishedIso,
    author: { "@type": "Organization", name: site.siteName },
    publisher: { "@type": "Organization", name: site.siteName },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(article.title)} | ${site.siteName}</title>
<meta name="description" content="${escapeHtml(article.meta)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(article.title)}">
<meta property="og:description" content="${escapeHtml(article.meta)}">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="${escapeHtml(site.siteName)}">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(article.title)}">
<meta name="twitter:description" content="${escapeHtml(article.meta)}">
${site.twitterHandle ? `<meta name="twitter:site" content="${escapeHtml(site.twitterHandle)}">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../style.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
${gaSnippet()}</head>
<body>

<header class="site-header">
  <div class="site-header-inner">
    <a href="../index.html" class="brand">${escapeHtml(site.siteName)}</a>
  </div>
</header>
<div class="disclosure-banner">本サイトはアフィリエイト広告を利用する場合があります</div>

<main>
  <a href="../index.html" class="back-link">← 記事一覧に戻る</a>
  <article>
    <header class="article-header">
      <div class="article-date">${formatDateJa(publishedIso)}</div>
      <h1 class="article-title">${escapeHtml(article.title)}</h1>
    </header>
    <div class="article-body">
      ${bodyHtml}
    </div>
    <div class="article-disclaimer">
      本記事は情報提供を目的としており、特定商品の購入を保証・断定するものではありません。価格・在庫・キャンペーン内容は変動するため、購入前に公式サイトで最新情報をご確認ください。本サイトはアフィリエイト広告を利用する場合があります。
    </div>
    ${relatedArticlesHtml(article, allArticles)}
  </article>
</main>

<footer class="site-footer">
  <a href="../operator.html">運営者情報</a>
  <a href="../privacy-policy.html">プライバシーポリシー</a>
  <a href="../contact.html">お問い合わせ</a>
</footer>

</body>
</html>
`;
}

function articleCardHtml(a) {
  return `
      <a class="article-card" href="articles/${escapeHtml(a.slug)}.html">
        <div class="article-card-date">${formatDateJa(a.createdAt)}</div>
        <h2>${escapeHtml(a.title)}</h2>
        <p>${escapeHtml(a.meta)}</p>
      </a>
    `;
}

function buildIndexHtml(articles) {
  const sorted = articles.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const tabsHtml = sorted.length === 0 ? "" : `
  <div class="category-tabs" role="tablist">
    <button type="button" class="category-tab is-active" role="tab" data-category="all">すべて<span class="category-tab-count">${sorted.length}</span></button>
    ${CATEGORIES.map((c) => {
      const count = sorted.filter((a) => (a.category || "kihon") === c.key).length;
      if (count === 0) return "";
      return `<button type="button" class="category-tab" role="tab" data-category="${c.key}">${escapeHtml(c.label)}<span class="category-tab-count">${count}</span></button>`;
    }).join("")}
  </div>`;

  const searchHtml = sorted.length === 0 ? "" : `
  <div class="article-search">
    <input type="search" id="article-search-input" placeholder="キーワードで検索(例:ファッション、送料)" aria-label="記事をキーワードで検索">
  </div>`;

  const listHtml = sorted.length === 0
    ? `<div class="empty-state">まだ記事がありません。近日公開予定です。</div>`
    : sorted.map((a) => {
        const searchText = [a.title, a.meta, a.keywords].filter(Boolean).join(" ").toLowerCase();
        return `<div class="article-card-wrap" data-category="${escapeHtml(a.category || "kihon")}" data-search="${escapeHtml(searchText)}">${articleCardHtml(a)}</div>`;
      }).join("");

  const tabScript = sorted.length === 0 ? "" : `
<script>
(function() {
  var tabs = document.querySelectorAll(".category-tab");
  var cards = document.querySelectorAll(".article-card-wrap");
  var searchInput = document.getElementById("article-search-input");
  var currentCategory = "all";
  var currentQuery = "";
  function applyFilter() {
    cards.forEach(function(card) {
      var matchesCategory = currentCategory === "all" || card.getAttribute("data-category") === currentCategory;
      var matchesQuery = currentQuery === "" || card.getAttribute("data-search").indexOf(currentQuery) !== -1;
      card.hidden = !(matchesCategory && matchesQuery);
    });
  }
  tabs.forEach(function(tab) {
    tab.addEventListener("click", function() {
      tabs.forEach(function(t) { t.classList.remove("is-active"); });
      tab.classList.add("is-active");
      currentCategory = tab.getAttribute("data-category");
      applyFilter();
    });
  });
  if (searchInput) {
    searchInput.addEventListener("input", function() {
      currentQuery = searchInput.value.trim().toLowerCase();
      applyFilter();
    });
  }
})();
</script>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.siteName,
    url: site.baseUrl,
    description: site.description,
  };

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(site.siteName)} | 楽天ラクヨコのプチプラ・トレンドをやさしく整理</title>
<meta name="description" content="${escapeHtml(site.description)}">
<link rel="canonical" href="${site.baseUrl}/">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(site.siteName)} | 楽天ラクヨコのプチプラ・トレンドをやさしく整理">
<meta property="og:description" content="${escapeHtml(site.description)}">
<meta property="og:url" content="${site.baseUrl}/">
<meta name="twitter:card" content="summary">
${site.googleSiteVerification ? `<meta name="google-site-verification" content="${escapeHtml(site.googleSiteVerification)}">\n` : ""}<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="style.css">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
${gaSnippet()}</head>
<body>

<header class="site-header">
  <div class="site-header-inner">
    <a href="index.html" class="brand">${escapeHtml(site.siteName)}</a>
    <p class="site-tagline">楽天ラクヨコのプチプラ・トレンドアイテムを、もっと楽しく</p>
  </div>
</header>
<div class="disclosure-banner">本サイトはアフィリエイト広告を利用する場合があります</div>

<main>
  ${searchHtml}
  ${tabsHtml}
  <div id="article-list" class="article-list">${listHtml}</div>
</main>

<footer class="site-footer">
  <a href="operator.html">運営者情報</a>
  <a href="privacy-policy.html">プライバシーポリシー</a>
  <a href="contact.html">お問い合わせ</a>
</footer>
${tabScript}
</body>
</html>
`;
}

function buildSitemapXml(articles) {
  const urls = [
    `${site.baseUrl}/`,
    ...articles.map((a) => `${site.baseUrl}/articles/${a.slug}.html`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>
`;
}

function buildRobotsTxt() {
  return `User-agent: *\nAllow: /\nSitemap: ${site.baseUrl}/sitemap.xml\n`;
}

function publishArticle(article) {
  fs.mkdirSync(ARTICLES_DIR, { recursive: true });

  const articles = readArticleIndex();
  const existingIdx = articles.findIndex((a) => a.slug === article.slug);
  const entry = {
    slug: article.slug, title: article.title, meta: article.meta,
    keywords: article.keywords, createdAt: article.createdAt,
    category: article.category || inferCategory(article),
  };
  if (existingIdx >= 0) articles[existingIdx] = entry; else articles.push(entry);
  writeArticleIndex(articles);

  fs.writeFileSync(path.join(ARTICLES_DIR, `${article.slug}.html`), buildArticleHtml(article, articles), "utf8");
  fs.writeFileSync(path.join(DOCS_DIR, "index.html"), buildIndexHtml(articles), "utf8");
  fs.writeFileSync(path.join(DOCS_DIR, "sitemap.xml"), buildSitemapXml(articles), "utf8");
  fs.writeFileSync(path.join(DOCS_DIR, "robots.txt"), buildRobotsTxt(), "utf8");

  return path.join(ARTICLES_DIR, `${article.slug}.html`);
}

function rebuildIndexOnly() {
  const articles = readArticleIndex();
  fs.writeFileSync(path.join(DOCS_DIR, "index.html"), buildIndexHtml(articles), "utf8");
}

module.exports = { publishArticle, readArticleIndex, writeArticleIndex, rebuildIndexOnly, inferCategory, CATEGORIES };
