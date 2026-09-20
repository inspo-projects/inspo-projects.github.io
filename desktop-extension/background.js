const APP_URL = "https://inspo-projects.github.io/";

function canShare(url = "") {
  return /^https?:\/\//i.test(url);
}

function openInspoShare(url, title = "") {
  if (!canShare(url)) return;
  const target = new URL(APP_URL);
  target.searchParams.set("share_target", "1");
  target.searchParams.set("shared_url", url);
  if (title) target.searchParams.set("shared_title", title);
  chrome.tabs.create({ url: target.toString() });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "inspo-save-page",
      title: "Save page to Inspo Projects",
      contexts: ["page"]
    });
    chrome.contextMenus.create({
      id: "inspo-save-link",
      title: "Save link to Inspo Projects",
      contexts: ["link"]
    });
  });
});

chrome.action.onClicked.addListener((tab) => {
  openInspoShare(tab?.url || "", tab?.title || "");
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "inspo-save-link") {
    openInspoShare(info.linkUrl || "", "");
    return;
  }
  if (info.menuItemId === "inspo-save-page") {
    openInspoShare(info.pageUrl || tab?.url || "", tab?.title || "");
  }
});
