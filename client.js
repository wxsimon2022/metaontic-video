(() => {
  // src/platform/settings/client.ts
  function createSettingsPages(h, decorate = (Page) => Page) {
    let pages = /* @__PURE__ */ new Map();
    return {
      register(page) {
        let group = pages.get(page.namespace) || [];
        if (group.some((existing) => existing.id === page.id)) throw new Error(`重复的设置页：${page.id}`);
        group.push(page), pages.set(page.namespace, group);
      },
      mount(ctx) {
        for (let [namespace, group] of pages) {
          let Content = group.length === 1 ? group[0].Page : (props) => h("div", {}, ...group.map((page) => h(page.Page, { ...props, key: page.id }))), Page = decorate(Content);
          ctx.effect(() => ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
            name: "plugins.bundle.config",
            key: namespace,
            locale: group[0].locale
          }, Page)), `${namespace}: configuration page`);
        }
      }
    };
  }

  // src/app/composition/client.composer.ts
  function createClientRuntime(require2, modules) {
    let ids = /* @__PURE__ */ new Set(), plugins = modules.map((module) => {
      if (!module.id || ids.has(module.id)) throw new Error(`重复或无效的界面模块：${module.id}`);
      return ids.add(module.id), module.create(require2);
    });
    return {
      inject: [...new Set(plugins.flatMap((plugin) => plugin.inject || []))],
      apply(ctx, options = {}) {
        let settings = createSettingsPages(require2("react").createElement, options.decorateSettings);
        for (let plugin of plugins) plugin.apply(ctx, { settings });
        settings.mount(ctx);
      }
    };
  }

  // src/ui/components/configured-entries.ts
  function followConfiguredEntries(form, key, registrations, defaultEnabled = !0) {
    let active = !1, disposed = !1, known = defaultEnabled, cleanups = [], close = () => {
      let pending = cleanups;
      cleanups = [], active = !1;
      for (let off of pending.reverse())
        try {
          off();
        } catch {
        }
    }, sync = () => {
      if (!disposed) {
        try {
          let value = form?.getSnapshot?.()?.value?.[key];
          known = value === void 0 ? defaultEnabled : value === !0;
        } catch {
          return;
        }
        if (known !== active) {
          if (!known) {
            close();
            return;
          }
          try {
            for (let register of registrations) {
              let off = register();
              typeof off == "function" && cleanups.push(off);
            }
            active = !0;
          } catch (error) {
            throw close(), error;
          }
        }
      }
    };
    sync();
    let unsubscribe;
    try {
      unsubscribe = form?.subscribe?.(sync);
    } catch {
    }
    return () => {
      disposed = !0;
      try {
        typeof unsubscribe == "function" && unsubscribe();
      } finally {
        close();
      }
    };
  }

  // src/shared/constants/plugin.ts
  var PLUGIN_ID = "metaontic-video", PLUGIN_PACKAGE = "dsh-metaontic-video", PLUGIN_NAMESPACE = PLUGIN_ID;
  var PANEL_ID = PLUGIN_ID, FLOW_CANVAS_AVAILABLE = !1, CANVAS_PANEL_ID = `${PLUGIN_ID}-canvas`, GUIDE_URL = "https://ai.mybfs.cn";
  var SUPPORT_URL = "https://work.weixin.qq.com/kfid/kfcd6fc4ca793eeac18", GITEE = {
    slug: "hackloop/metaontic-video",
    web: "https://gitee.com/hackloop/metaontic-video",
    api: "https://gitee.com/api/v5/repos/hackloop/metaontic-video",
    transport: "git@gitee.com:hackloop/metaontic-video.git"
  }, GITHUB = {
    slug: "wxsimon2022/metaontic-video",
    web: "https://github.com/wxsimon2022/metaontic-video",
    api: "https://api.github.com/repos/wxsimon2022/metaontic-video",
    transport: "git@ssh.github.com:wxsimon2022/metaontic-video.git"
  }, CHANGELOG_URL = `${GITHUB.web}/blob/master/CHANGELOG.md`, UPDATE_SPEC = `git+${GITEE.web}.git`, UPDATE_CACHE_KEY = `${PLUGIN_ID}.update-check-v3`, UPDATE_MAX_AGE_MS = 360 * 60 * 1e3, UPDATE_ATTEMPTS = 3;
  var releaseDownloadUrl = (version, channel = "gitee") => `${(channel === "github" ? GITHUB : GITEE).web}${channel === "github" ? "/releases/latest/download" : "/releases/download/latest"}/${PLUGIN_ID}.tgz?version=${encodeURIComponent(version)}`, RELAY = {
    baseUrl: "https://ai.bileego.com",
    //signupUrl: 'https://ai.bileego.com/sign-up?aff=VzYr',
    signupUrl: "https://ai.bileego.com",
    pricingUrl: "https://ai.bileego.com/pricing",
    submitPath: "/doubao/api/v3/contents/generations/tasks",
    queryPath: "/doubao/api/v3/contents/generations/tasks/{task_id}",
    baseEnv: ["NEWAPI_VIDEO_BASE_URL", "NEWAPI_BASE_URL"],
    modelEnv: ["NEWAPI_VIDEO_MODEL"],
    textModelEnv: ["NEWAPI_TEXT_MODEL"]
  }, VOLCENGINE = {
    modeAvailable: !1,
    baseUrl: "https://ark.cn-beijing.volces.com",
    submitPath: "/api/v3/contents/generations/tasks",
    queryPath: "/api/v3/contents/generations/tasks/{task_id}",
    pricingUrl: "https://docs.volcengine.com/docs/ark/model-pricing"
  }, VIDEO_MODEL = "doubao-seedance-2-0-mini-260615", VIDEO_MODEL_OPTIONS = [
    "doubao-seedance-2-0-mini-260615",
    "doubao-seedance-2-0-fast-260128"
  ], IMAGE_MODEL = "doubao-seedream-5-0-pro-260628", RETIRED_IMAGE_MODELS = ["doubao-seedream-5-0-260128"], TEXT_MODELS = ["deepseek v4.1 flash", "deepseekv4pro"], TEXT_MODEL = TEXT_MODELS[0], RETIRED_TEXT_MODELS = ["doubao-seed-1-6-250615"];
  var REFERENCE_TMP_DIR = `${PLUGIN_ID}-reference`;

  // src/ui/components/support-action.ts
  function createSupportAction({ React, t, PAGE_CSS }) {
    let h = React.createElement;
    return function({ subject }) {
      let [open, setOpen] = React.useState(!1), dialog = React.useRef(null), ownBundle = subject?.kind === "bundle" && subject.pkg?.name === PLUGIN_PACKAGE;
      return React.useEffect(() => {
        setOpen(!1);
      }, [ownBundle]), React.useEffect(() => {
        open && dialog.current && !dialog.current.open && dialog.current.showModal();
      }, [open]), ownBundle ? h(
        React.Fragment,
        null,
        h("style", null, PAGE_CSS),
        h("button", {
          type: "button",
          className: "mov-btn mov-btn-sm",
          "data-action": "contact-support",
          style: { alignSelf: "center", whiteSpace: "nowrap" },
          "aria-haspopup": "dialog",
          "aria-expanded": open,
          onClick: () => setOpen(!0)
        }, t("supportContact")),
        open ? h("dialog", {
          ref: dialog,
          className: "mov-support-dialog",
          "aria-labelledby": "mov-support-title",
          onCancel: () => setOpen(!1),
          onClose: () => setOpen(!1),
          onClick: (event) => {
            if (event.target === event.currentTarget) {
              let rect = event.currentTarget.getBoundingClientRect();
              (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) && setOpen(!1);
            }
          }
        }, h(
          "div",
          { className: "mov-support-content" },
          h(
            "div",
            { className: "mov-card-head" },
            h("strong", { id: "mov-support-title" }, t("supportContact")),
            h("button", { type: "button", className: "mov-btn mov-btn-sm mov-trailing", "aria-label": t("supportClose"), onClick: () => setOpen(!1) }, t("supportClose"))
          ),
          h("p", { className: "mov-hint" }, t("supportScan")),
          h("iframe", { className: "mov-support-frame", title: t("supportContact"), src: SUPPORT_URL, referrerPolicy: "no-referrer" }),
          h("a", { href: SUPPORT_URL, target: "_blank", rel: "noopener noreferrer" }, t("supportOpenPage"))
        )) : null
      ) : null;
    };
  }

  // src/ui/components/auth-notice.ts
  var TOOL_ARGS_JSON = /Tool call[^\n]*JSON|Expected ',' or '\}' after property value|Unexpected (?:token|end of JSON input)/i;
  function createAuthNotice({ h, Original, hostT, t }) {
    return function(props) {
      let data = props.node?.data;
      return data?.code !== "AUTH" ? typeof data?.message == "string" && TOOL_ARGS_JSON.test(data.message) ? h("div", { role: "status", "data-field": "tool-args-notice", style: { display: "flex", gap: 10, padding: "10px 0", alignItems: "flex-start" } }, [
        h("span", { key: "dot", "aria-hidden": !0, style: { flex: "0 0 auto", width: 7, height: 7, marginTop: 6, borderRadius: "50%", background: "var(--dsw-alias-state-error-primary,#d9534f)" } }),
        h("div", { key: "copy", style: { minWidth: 0, fontSize: 13, lineHeight: 1.65, color: "var(--dsw-alias-label-primary,inherit)" } }, [
          h("strong", { key: "title", style: { fontWeight: 500 } }, t("toolArgsNoticeTitle")),
          h("div", { key: "hint", style: { color: "var(--dsw-alias-label-secondary,inherit)" } }, t("toolArgsNoticeHint")),
          h("div", { key: "raw", style: { marginTop: 4, fontSize: 12, color: "var(--dsw-alias-label-caption,inherit)", wordBreak: "break-word" } }, data.message)
        ])
      ]) : h(Original, { ...props, t: hostT }) : h("div", { role: "status", "data-field": "auth-notice", style: { display: "flex", gap: 10, padding: "10px 0", alignItems: "flex-start" } }, [
        h("span", { key: "dot", "aria-hidden": !0, style: { flex: "0 0 auto", width: 7, height: 7, marginTop: 6, borderRadius: "50%", background: "var(--dsw-alias-state-error-primary,#d9534f)" } }),
        h("div", { key: "copy", style: { minWidth: 0, fontSize: 13, lineHeight: 1.65, color: "var(--dsw-alias-label-primary,inherit)" } }, [
          h("strong", { key: "title", style: { fontWeight: 500 } }, t("authNoticeTitle")),
          h("div", { key: "hint", style: { color: "var(--dsw-alias-label-secondary,inherit)" } }, t("authNoticeHint")),
          h("a", { key: "support", href: "https://work.weixin.qq.com/kfid/kfcd6fc4ca793eeac18", target: "_blank", rel: "noopener noreferrer", referrerPolicy: "no-referrer" }, t("supportContact"))
        ])
      ]);
    };
  }
  function registerAuthNotice(ctx, h, t) {
    if (typeof ctx.slots.entriesOfSlot != "function") return;
    let original = ctx.slots.entriesOfSlot("conversation.chat.node").filter((entry2) => entry2.options?.key === "turn-error").sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0))[0];
    if (!original?.component) return;
    let Notice = createAuthNotice({ h, Original: original.component, hostT: ctx.locale.bind(original.locale || "chat"), t });
    return ctx.slots.register({ name: "conversation.chat.node", key: "turn-error", priority: (original.options.priority || 0) + 1, locale: "chat" }, Notice);
  }

  // src/businesses/video-generation/client/tool-result.ts
  var SUMMARY_TOOLS = { video_project: "脚本审核", video_estimate: "费用试算" }, ACTION_LABELS = { prepare: "准备项目", review: "脚本审核", review_segment: "分段结果审核", status: "读取项目状态" }, STATUS_LABELS = { approved: "已通过", draft: "待修改", pending: "待确认", blocked: "未通过校验", running: "进行中" }, CANVAS_SYNC_LABELS = { synced: "已同步", pending: "待补传（用video_canvas补传，不重新生成）", unavailable: "暂不可用", external: "沿用所选画布" }, textOf = (block) => (Array.isArray(block?.content) ? block.content : []).filter((part) => part?.type === "text").map((part) => String(part.text || "")).join(`
`).trim(), money = (value) => Number.isFinite(Number(value)) ? `¥${(Math.round(Number(value) * 1e4) / 1e4).toFixed(4)}` : "";
  function parseJson(text) {
    let body = text.trim().replace(/^```[a-zA-Z]*\s*/, "").replace(/```$/, "").trim();
    try {
      let data = JSON.parse(body);
      return data && typeof data == "object" ? data : null;
    } catch {
      return null;
    }
  }
  function toolSummary(toolName, block) {
    let title = SUMMARY_TOOLS[toolName];
    if (!title) return null;
    let raw = textOf(block);
    if (!block || !("kind" in block)) {
      let args = block?.args || {}, rows2 = [];
      return args.action && rows2.push(["动作", ACTION_LABELS[String(args.action)] || String(args.action)]), args.duration && rows2.push(["目标时长", `${Number(args.duration)} 秒`]), args.resolution && rows2.push(["清晰度", String(args.resolution).toUpperCase()]), { title, state: "running", stateLabel: "进行中", rows: rows2, raw: "" };
    }
    if (block.isError) return { title, state: "error", stateLabel: "未完成", rows: [], raw };
    let data = parseJson(raw);
    if (!data) return { title, state: "done", stateLabel: "已完成", rows: [], raw };
    let rows = [], push = (label, value) => {
      value != null && String(value) !== "" && rows.push([label, String(value)]);
    };
    if (toolName === "video_estimate")
      return push("目标时长", data.duration ? `${data.duration} 秒` : ""), push("画幅 / 清晰度", [data.ratio, data.resolution && String(data.resolution).toUpperCase()].filter(Boolean).join(" · ")), push("火山官方方案", money(data.official?.cny)), push("插件方案", money(data.plugin?.cny)), push("价目日期", data.priceDate), { title, state: "ok", stateLabel: "已试算", rows, raw };
    push("状态", STATUS_LABELS[String(data.status)] || data.status), push("项目", data.projectId), push("下一步", data.nextAction), push("说明", data.reason);
    let canvasSync = String(data.canvasProject?.status || "");
    canvasSync && canvasSync !== "disabled" && push("画布同步", CANVAS_SYNC_LABELS[canvasSync] || canvasSync);
    let state = data.status === "approved" ? "ok" : ["draft", "blocked"].includes(String(data.status)) ? "warn" : "done";
    return { title, state, stateLabel: STATUS_LABELS[String(data.status)] || "已完成", rows, raw };
  }
  var SUMMARY_CSS = `
  .mov-summary { box-sizing: border-box; width: 100%; min-width: 0; margin: 6px 0; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l2,#dfe3eb); border-radius: 10px; color: inherit; }
  .mov-summary-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .mov-summary-title { font-size: 13px; font-weight: 600; }
  .mov-summary-rows { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; margin: 8px 0 0; font-size: 12.5px; }
  .mov-summary-key { color: var(--dsw-alias-label-caption,#737b8b); }
  .mov-summary-val { margin: 0; min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
  .mov-summary-raw { margin-top: 8px; font-size: 12px; }
  .mov-summary-raw > summary { color: var(--dsw-alias-label-caption,#737b8b); cursor: pointer; }
  .mov-summary-text { margin-top: 6px; color: var(--dsw-alias-label-caption,#737b8b); line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
`;
  function createToolResultView({ h, MediaPreview, VideoTaskProgress }) {
    function summaryView(props) {
      let summary = toolSummary(props?.toolName, props?.block);
      if (!summary) return null;
      let chip = summary.state === "ok" ? "mov-chip mov-chip-ok" : summary.state === "running" ? "mov-chip movc-badge" : "mov-chip mov-chip-bad";
      return h("div", { className: "mov-summary", "data-field": "tool-summary" }, [
        h("style", { key: "style" }, SUMMARY_CSS),
        h("div", { key: "head", className: "mov-summary-head" }, [
          h("span", { key: "title", className: "mov-summary-title" }, summary.title),
          h("span", { key: "state", className: chip }, summary.stateLabel)
        ]),
        summary.rows.length ? h("dl", { key: "rows", className: "mov-summary-rows" }, summary.rows.flatMap(([key, value]) => [
          h("dt", { key: `${key}-key`, className: "mov-summary-key" }, key),
          h("dd", { key: `${key}-value`, className: "mov-summary-val" }, value)
        ])) : null,
        summary.raw ? h("details", { key: "raw", className: "mov-summary-raw" }, [
          h("summary", { key: "label" }, "查看完整返回"),
          h("div", { key: "text", className: "mov-summary-text" }, summary.raw)
        ]) : null
      ]);
    }
    function ToolResultView(props) {
      return toolSummary(props?.toolName, props?.block) ? summaryView(props) : props.block && "kind" in props.block ? h(MediaPreview, props) : ["video_generate", "video_extend"].includes(props.toolName) ? h(VideoTaskProgress, props) : null;
    }
    return { ToolResultView };
  }

  // src/businesses/video-generation/client/media-preview.ts
  function localMediaUrl(file, base) {
    if (typeof file != "string" || /[\u0000-\u001f\u007f]/.test(file) || !/^(?:\/(?!\/)|[a-z]:[/\\])/i.test(file) || typeof base != "string" || !/^https?:/i.test(base) && !base.startsWith("dsh-app://app/")) return "";
    try {
      return new URL(`api/file?path=${encodeURIComponent(file)}`, base).href;
    } catch {
      return "";
    }
  }
  function remoteMediaUrl(value) {
    try {
      let url = new URL(String(value || ""));
      return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
    } catch {
      return "";
    }
  }
  function previewMediaFromBlock(block, toolName) {
    if (!block || !("kind" in block) || block.isError) return [];
    let projected = block.meta?.metaonticMedia;
    if (projected?.version === 1 && Array.isArray(projected.media)) return projected.media.filter((item) => item && ["video", "image"].includes(item.kind)).slice(0, 40);
    let text = (Array.isArray(block.content) ? block.content : []).filter((p) => p.type === "text").map((p) => p.text || "").join(`
`), media = [], seen = /* @__PURE__ */ new Set();
    for (let match of text.matchAll(/\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^\s)]+))\s*\)/g)) {
      let source = match[2] || match[3];
      if (seen.has(source)) continue;
      let kind = /\.(png|jpe?g|webp|gif|svg)(?:[?#]|$)/i.test(source) || /图片|参考图/.test(match[1]) || toolName === "video_prepare_image" ? "image" : /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(source) || /视频|第.*段/.test(match[1]) ? "video" : "";
      if (!kind) continue;
      seen.add(source);
      let url = remoteMediaUrl(source), file = "";
      if (!url)
        try {
          file = decodeURI(source);
        } catch {
          continue;
        }
      if (media.push({ kind, label: match[1] || (kind === "image" ? "图片" : "视频"), ...url ? { url } : { localPath: file } }), media.length >= 40) break;
    }
    return media;
  }
  function createMediaPreview({ React, h }) {
    function MediaItem({ item }) {
      let sources = [...new Set([localMediaUrl(item.localPath, document.baseURI), remoteMediaUrl(item.url)].filter(Boolean))], signature = sources.join(`
`), [index, setIndex] = React.useState(0), [failed, setFailed] = React.useState(!1), [zoom, setZoom] = React.useState(!1), dialog = React.useRef(null);
      React.useEffect(() => {
        setIndex(0), setFailed(!1), setZoom(!1);
      }, [signature]), React.useEffect(() => {
        zoom && dialog.current && !dialog.current.open && dialog.current.showModal();
      }, [zoom]);
      let source = sources[index] || "", error = () => {
        index + 1 < sources.length ? setIndex(index + 1) : setFailed(!0);
      }, label = String(item.label || (item.kind === "image" ? "图片" : "视频")), media = !source || failed ? h("p", { role: "status", className: "mov-media-error" }, item.kind === "image" ? "图片预览无法加载，文件可能已移动或链接已过期。请尝试打开原图。" : "视频预览无法播放，可能是文件已移动、链接已过期或编码不受支持。请尝试打开原视频或下载后播放。") : item.kind === "image" ? h("button", { type: "button", className: "mov-media-image-button", onClick: () => setZoom(!0), "aria-label": `放大${label}` }, h("img", { src: source, alt: label, loading: "lazy", onError: error, className: "mov-media-image", referrerPolicy: "no-referrer" })) : h("video", { key: source, src: source, controls: !0, playsInline: !0, preload: "metadata", onError: error, className: "mov-media-video", "aria-label": label, referrerPolicy: "no-referrer" });
      return h("figure", { className: "mov-media-item", "data-media-kind": item.kind }, [
        h("figcaption", { key: "caption", className: "mov-media-caption" }, label),
        h("div", { key: "body", className: "mov-media-surface" }, media),
        sources.length ? h("div", { key: "links", className: "mov-media-links" }, [
          h("a", { key: "open", href: source || sources[0], target: "_blank", rel: "noopener noreferrer", referrerPolicy: "no-referrer" }, item.kind === "image" ? "打开原图" : "打开原视频"),
          item.localPath && remoteMediaUrl(item.url) ? h("a", { key: "remote", href: remoteMediaUrl(item.url), target: "_blank", rel: "noopener noreferrer", referrerPolicy: "no-referrer" }, "上游链接") : null
        ]) : null,
        zoom && item.kind === "image" ? h("dialog", { key: "zoom", ref: dialog, className: "mov-media-dialog", "aria-label": label, onCancel: () => setZoom(!1), onClose: () => setZoom(!1), onClick: (e) => {
          e.target === e.currentTarget && setZoom(!1);
        } }, [
          h("button", { key: "close", type: "button", className: "mov-media-close", onClick: () => {
            dialog.current?.close(), setZoom(!1);
          }, "aria-label": "关闭图片预览" }, "关闭"),
          h("img", { key: "image", src: source, alt: label, className: "mov-media-zoom", referrerPolicy: "no-referrer", onError: error })
        ]) : null
      ]);
    }
    function MediaPreview({ block, toolName }) {
      let items = previewMediaFromBlock(block, toolName), [expanded, setExpanded] = React.useState(!1);
      if (!items.length) return null;
      let visible = expanded ? items : items.slice(0, 2);
      return h("section", { className: "mov-media-preview", "aria-label": "生成结果预览", "data-field": "media-preview" }, [
        h("style", { key: "styles" }, `
        .mov-media-preview{margin-top:12px;min-width:0;color:var(--dsw-alias-label-primary,inherit)}
        .mov-media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px;min-width:0}
        .mov-media-item{margin:0;min-width:0;border:1px solid var(--dsw-alias-border-l2,#dfe3eb);border-radius:10px;overflow:hidden}
        .mov-media-caption{padding:8px 12px;font-size:13px;font-weight:600;overflow-wrap:anywhere}
        .mov-media-surface{min-width:0;background:var(--dsw-specific-input-major,#f5f6f8)}
        .mov-media-image-button{display:block;width:100%;padding:0;border:0;background:transparent;cursor:zoom-in}
        .mov-media-image{display:block;width:100%;max-height:320px;object-fit:contain}
        .mov-media-video{display:block;width:100%;max-height:420px;background:#10131a;object-fit:contain}
        .mov-media-links{display:flex;gap:16px;flex-wrap:wrap;padding:8px 12px;font-size:12px}
        .mov-media-links a{color:var(--dsw-alias-link,#247bbf);text-decoration:underline;overflow-wrap:anywhere}
        .mov-media-error{margin:0;padding:18px 12px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-caption,#737b8b)}
        .mov-media-more{margin-top:10px;border:1px solid var(--dsw-alias-border-l2,#dfe3eb);border-radius:6px;padding:6px 10px;background:transparent;color:inherit;cursor:pointer}
        .mov-media-dialog{box-sizing:border-box;max-width:94vw;max-height:94vh;padding:42px 12px 12px;border:0;border-radius:12px;background:var(--dsw-alias-settings-card-fill,#fff);color:inherit}
        .mov-media-dialog::backdrop{background:rgba(0,0,0,.7)}
        .mov-media-zoom{display:block;max-width:calc(94vw - 24px);max-height:calc(94vh - 70px);object-fit:contain}
        .mov-media-close{position:absolute;top:8px;right:10px;background:transparent;color:inherit;border:1px solid var(--dsw-alias-border-l2,#dfe3eb);border-radius:6px;padding:4px 10px;cursor:pointer}
        .mov-media-image-button:focus-visible,.mov-media-more:focus-visible,.mov-media-close:focus-visible{outline:2px solid #247bbf;outline-offset:-2px}
      `),
        h("div", { key: "grid", className: "mov-media-grid" }, visible.map((item) => h(MediaItem, { key: `${item.kind}:${item.localPath || item.url}`, item }))),
        items.length > 2 ? h("button", { key: "more", type: "button", className: "mov-media-more", onClick: () => setExpanded(!expanded), "aria-expanded": expanded }, expanded ? "收起其他成果" : `展开其他成果（${items.length - 2}）`) : null
      ]);
    }
    return { MediaPreview };
  }

  // src/ui/components/theme.ts
  function createTheme() {
    let TOKENS = {
      text: "var(--dsw-alias-label-primary, inherit)",
      muted: "var(--dsw-alias-label-caption, #8886)",
      border: "var(--dsw-alias-border-l2, #8884)",
      cardFill: "var(--dsw-alias-settings-card-fill, transparent)",
      controlFill: "var(--dsw-specific-input-major, transparent)",
      primaryFill: "var(--dsw-alias-button-primary-fill, #247bbf)",
      error: "var(--dsw-alias-state-error-primary, #d9534f)",
      success: "var(--dsw-alias-state-success-primary, #2e9e5b)"
    }, inputStyle = { width: "100%", boxSizing: "border-box" }, PAGE_CSS = `
      /* 仅收紧包含本插件设置的宿主详情区，不依赖宿主生成的 CSS 类名。 */
      div:has(> section[data-plugin-config] .mov-page) { margin-top: 12px; gap: 16px; }
      /* 整页纵向排布：块与块之间统一 16px，比一整片表单好扫 */
      .mov-page { display: flex; flex-direction: column; gap: 16px; padding: 0; color: ${TOKENS.text}; }
      /* 分组卡片：16 个字段摊在一格里太糊，按用途各装一张卡 */
      .mov-section { display: flex; flex-direction: column; gap: 14px; padding: 14px 16px 16px; border-radius: 12px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.cardFill}; }
      .mov-interface .mov-grid { grid-template-columns: minmax(0, 1fr); }
      .mov-model-card { background: ${TOKENS.cardFill}; }
      .mov-advanced { display: block; }
      .mov-advanced-toggle { cursor: pointer; font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-advanced-toggle .mov-hint { display: block; margin: 5px 0 0 16px; font-weight: 400; }
      .mov-advanced-toggle:focus-visible { outline: 2px solid ${TOKENS.primaryFill}; outline-offset: 5px; border-radius: 4px; }
      .mov-advanced-body { display: flex; flex-direction: column; gap: 18px; border-top: 1px solid ${TOKENS.border}; margin-top: 14px; padding-top: 16px; }
      .mov-advanced-body .mov-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 18px; align-items: start; }
      .mov-advanced-body .mov-field-wide { grid-column: auto; }
      .mov-advanced-group { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .mov-advanced-group + .mov-advanced-group { border-top: 1px solid ${TOKENS.border}; padding-top: 16px; }
      .mov-advanced-group .mov-label { min-height: 30px; display: flex; align-items: flex-end; }
      .mov-advanced-tools .mov-grid { grid-template-columns: minmax(0, 1fr); }
      .mov-advanced-tools .mov-label { min-height: 0; }
      .mov-advanced-group[data-group="advancedPicture"] .mov-grid { grid-template-columns: minmax(0, 1fr); }

      @container (max-width: 480px) { .mov-advanced-body .mov-grid { grid-template-columns: minmax(0, 1fr); } .mov-advanced-group .mov-label { min-height: 0; } }
      .mov-advanced { container-type: inline-size; }
      .mov-section-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      /* 标题左边一道主色竖条，代替纯文字分组标题 */
      .mov-section-title::before { content: ""; flex: 0 0 auto; width: 3px; height: 13px; border-radius: 2px; background: ${TOKENS.primaryFill}; }
      .mov-section-title::after { content: ""; flex: 1 1 auto; height: 1px; background: ${TOKENS.border}; }
      /* 两列自适应：单列至少 240px，窄面板自动落成一列 */
      .mov-parameter-group { container-type: inline-size; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
      .mov-parameter-group + .mov-parameter-group { border-top: 1px solid ${TOKENS.border}; padding-top: 12px; }
      .mov-parameter-heading { font-size: 12px; font-weight: 600; color: ${TOKENS.muted}; }
      .mov-parameter-group .mov-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
      @container (max-width: 480px) { .mov-parameter-group .mov-grid { grid-template-columns: minmax(0, 1fr); } }
      .mov-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 14px 18px; }
      .mov-field { display: flex; flex-direction: column; min-width: 0; }
      .mov-model-settings { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
      .mov-model-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .mov-model-grid-single { grid-template-columns: minmax(0, 1fr); }
      .mov-model-card { display: flex; flex-direction: column; gap: 14px; padding: 12px; border: 1px solid ${TOKENS.border}; border-radius: 10px; min-width: 0; }
      .mov-parameter-group > .mov-card { border: 0; padding: 0; background: transparent; }
      @container (max-width: 600px) { .mov-model-grid { grid-template-columns: minmax(0, 1fr); } }

      .mov-av-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .mov-av-card { display: flex; flex-direction: column; min-width: 0; padding: 12px; gap: 8px; border: 1px solid ${TOKENS.border}; border-radius: 10px; background: ${TOKENS.cardFill}; }
      .mov-av-card > .mov-label { margin-bottom: -2px; }
      .mov-av-card .mov-hint { margin-top: auto; }
      .mov-switch { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 36px; padding: 0; border: 0; background: transparent; font-size: 13px; color: ${TOKENS.text}; cursor: pointer; }
      .mov-switch span { order: 0; }
      .mov-switch input { appearance: none; cursor: pointer; order: 1; flex: 0 0 36px; width: 36px; height: 20px; box-sizing: border-box; padding: 2px; margin: 0; border: 0; border-radius: 999px; background: var(--dsw-alias-border-l3, #8884); position: relative; }
      .mov-switch input::after { content: ''; position: absolute; width: 16px; height: 16px; left: 2px; top: 2px; border-radius: 50%; background: var(--dsw-alias-switch-thumb, #fff); transition: transform .12s ease; }
      .mov-switch input:checked { background: var(--dsw-alias-brand-primary, #247bbf); }
      .mov-switch input:checked::after { transform: translateX(16px); background: var(--dsw-alias-label-primary-foreground, #fff); }
      .mov-switch input:focus-visible { outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #247bbf)); outline-offset: 2px; }
      @container (max-width: 480px) { .mov-av-grid { grid-template-columns: minmax(0, 1fr); } }
      @media (prefers-reduced-motion: reduce) { .mov-switch input, .mov-switch input::after { transition: none; } }

      /* 开关没有标签行，靠底对齐才能跟旁边输入框的控制线齐平 */
      .mov-field-switch { justify-content: flex-end; }
      .mov-field-wide { grid-column: 1 / -1; }
      .mov-label { display: block; font-size: 12px; color: ${TOKENS.muted}; margin-bottom: 6px; }
      .mov-input { padding: 8px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.controlFill}; color: ${TOKENS.text}; font: inherit; font-size: 13px; height: 36px; }
      .mov-key-control { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .mov-key-control .mov-input { flex: 1 1 0; width: 0; min-width: 0; }
      .mov-key-eye { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 32px; height: 36px; padding: 0; border: 0; border-radius: 6px; color: ${TOKENS.muted}; background: transparent; cursor: pointer; }
      .mov-key-eye:hover { color: ${TOKENS.text}; background: ${TOKENS.controlFill}; }
      .mov-key-eye:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
      .mov-key-verify { flex: 0 0 auto; height: 36px; white-space: nowrap; }
      .mov-input:focus, .mov-input:focus-visible { outline: none; border-color: ${TOKENS.primaryFill}; box-shadow: 0 0 0 3px rgba(36, 123, 191, .18); }
      /* 模型 ID 与可执行文件路径很长：等宽字体 + 省略，不把整行撑变形 */
      .mov-mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 12.5px; }
      .mov-card { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 12px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.cardFill}; }
      .mov-current-version { display: inline-flex; align-items: center; gap: 6px; flex: 1 1 120px; }
      .mov-update-bell { display: inline-flex; flex: 0 0 auto; color: ${TOKENS.primaryFill}; transform-origin: 50% 10%; animation: mov-bell-swing 1.6s ease-in-out infinite; }
      @keyframes mov-bell-swing { 0%, 60%, 100% { transform: rotate(0deg); } 10%, 30% { transform: rotate(-18deg); } 20%, 40% { transform: rotate(18deg); } 50% { transform: rotate(-8deg); } }
      @media (prefers-reduced-motion: reduce) { .mov-update-bell { animation: none; } }
      .mov-card-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .mov-card-title { font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-hint { font-size: 12px; color: ${TOKENS.muted}; line-height: 1.5; }
      .mov-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; flex: 0 0 120px; width: 120px; min-width: 120px; height: 36px; min-height: 36px; padding: 4px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: transparent; color: ${TOKENS.text}; font: inherit; font-size: 12px; line-height: 1.2; text-align: center; cursor: pointer; white-space: normal; overflow-wrap: anywhere; transition: background .15s, border-color .15s, color .15s, opacity .15s; }
      .mov-btn:hover:not(:disabled) { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
      .mov-btn:disabled { opacity: .5; cursor: default; }
      .mov-btn-primary { border-color: ${TOKENS.primaryFill}; background: ${TOKENS.primaryFill}; color: #fff; font-weight: 600; }
      .mov-btn-primary:hover:not(:disabled) { color: #fff; opacity: .88; }
      .mov-quota-actions { display: flex; gap: 8px; flex: 0 0 auto; }
      .mov-support-dialog { width: min(420px, calc(100vw - 32px)); max-height: calc(100vh - 32px); padding: 0; border: 1px solid ${TOKENS.border}; border-radius: 12px; color: ${TOKENS.text}; background: ${TOKENS.cardFill}; overflow: auto; }
      .mov-support-dialog::backdrop { background: rgba(0, 0, 0, .45); }
      .mov-support-content { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      .mov-support-content p { margin: 0; }
      .mov-support-frame { width: 100%; height: min(480px, 62vh); border: 0; border-radius: 8px; background: white; }
      .mov-trailing { margin-left: auto; }
      /* 额度：三个数字块，一眼分清剩余 / 已用 / 总额度 */
      .mov-quota-compact { padding: 8px 12px; gap: 10px 14px; flex-direction: row; align-items: center; flex-wrap: wrap; }
      .mov-quota-compact .mov-card-head { min-height: 24px; flex: 0 0 auto; gap: 8px; }
      .mov-quota-compact .mov-stats { display: flex; flex: 1 1 auto; flex-wrap: wrap; gap: 8px 16px; min-width: 0; }
      .mov-quota-compact .mov-stat { flex-direction: row; align-items: baseline; justify-content: space-between; gap: 6px; padding: 0; border: 0; border-radius: 0; white-space: nowrap; }
      .mov-quota-compact .mov-stat-label { font-size: 11px; white-space: nowrap; }
      .mov-quota-compact .mov-stat-value { font-size: 14px; }
      .mov-quota-compact .mov-foot-note { font-size: 10px; white-space: nowrap; flex: 0 0 auto; }
      .mov-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
      .mov-stat { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; border: 1px solid ${TOKENS.border}; }
      .mov-stat-label { font-size: 11.5px; color: ${TOKENS.muted}; }
      .mov-stat-value { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
      .mov-foot-note { font-size: 11.5px; color: ${TOKENS.muted}; }
      /* ffmpeg 安装命令：一行等宽、可复制，不用撑满整行 */
      .mov-cmd-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .mov-tag { flex: 0 0 auto; min-width: 132px; font-size: 12px; color: ${TOKENS.muted}; }
      .mov-code { flex: 0 0 auto; max-width: 100%; padding: 6px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.controlFill}; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
      /* 使用记录：斑马纹 + 细表头，模型列吃掉剩余宽度 */
      /* 面板很窄时表格横向滚动，也不把「时间」挤成两行 */
      .mov-table { display: flex; flex-direction: column; margin: 0 -6px; overflow-x: auto; }
      .mov-table-head, .mov-table-row { display: grid; grid-template-columns: 106px 78px minmax(72px, 1fr) 84px 60px; align-items: center; gap: 10px; padding: 8px 10px; }
      .mov-table-head > :nth-child(1), .mov-table-row > :nth-child(1) { white-space: nowrap; }
      .mov-table-head { font-size: 11px; letter-spacing: .03em; color: ${TOKENS.muted}; border-bottom: 1px solid ${TOKENS.border}; }
      .mov-table-row { font-size: 12.5px; border-radius: 8px; }
      .mov-table-row:nth-child(even) { background: rgba(127, 127, 127, .05); }
      .mov-table-row:hover { background: rgba(127, 127, 127, .1); }
      /* 费用与结果两列右对齐，数字竖着对得齐 */
      .mov-table-head > :nth-child(4), .mov-table-row > :nth-child(4),
      .mov-table-head > :nth-child(5), .mov-table-row > :nth-child(5) { text-align: right; }
      .mov-model { min-width: 0; overflow: hidden; color: ${TOKENS.muted}; white-space: nowrap; text-overflow: ellipsis; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
      .mov-num { font-variant-numeric: tabular-nums; }
      /* 结果用胶囊标签，比裸文字更容易一眼扫到 */
      .mov-chip { display: inline-flex; align-items: center; justify-content: center; padding: 1px 8px; border-radius: 999px; font-size: 11.5px; line-height: 1.7; }
      .mov-chip-ok { color: ${TOKENS.success}; background: rgba(46, 158, 91, .12); }
      .mov-chip-bad { color: ${TOKENS.error}; background: rgba(217, 83, 79, .12); }
      /* 注册表单：输入框吃掉多余宽度，两个按钮不换行 */
      .mov-register-form { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      /* 底部操作条：上边线把「保存」和配置内容分开 */
      .mov-footer { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 2px 2px; border-top: 1px solid ${TOKENS.border}; }
      .mov-notice { margin: 0; font-size: 12px; color: ${TOKENS.muted}; line-height: 1.5; }
    `;
    return { TOKENS, inputStyle, PAGE_CSS };
  }

  // src/businesses/video-generation/client/progress.ts
  function estimatedVideoWait(duration) {
    let seconds = Number(duration);
    return Number.isFinite(seconds) && seconds > 0 ? 105 + seconds * 3 : 180;
  }
  function estimatedVideoProgress(elapsed, duration) {
    let seconds = Math.max(0, Number(elapsed) || 0);
    return Math.min(99, Math.max(1, Math.floor(seconds / estimatedVideoWait(duration) * 100)));
  }
  function activeVideoCalls(chat) {
    let calls = [], seen = /* @__PURE__ */ new Set();
    function visit(block) {
      if (!block)
        return;
      let done = "kind" in block, name = done ? block.call?.name : block.name;
      !done && ["video_generate", "video_extend"].includes(name) && !seen.has(block.callId) && (seen.add(block.callId), calls.push({ block, toolName: name, callId: block.callId }));
      for (let child of block.subCalls || [])
        visit(child);
    }
    let nodes = chat?.nodes?.values?.() ?? (chat?.order || []).map((key) => chat.nodes?.get(key));
    for (let node of nodes)
      node?.kind === "tool-call" && visit(node.data?.root);
    return calls;
  }
  function videoExecutionSource(eventSource) {
    let previous, snapshot = /* @__PURE__ */ new Map();
    return {
      subscribe: (listener) => eventSource.subscribe(listener),
      getSnapshot() {
        let window2 = eventSource.getSnapshot();
        if (window2 === previous)
          return snapshot;
        let next = /* @__PURE__ */ new Map();
        for (let { event } of window2.entries)
          if (event.type === "plugin:metaontic-video/execution") {
            let { callId, phase } = event.data || {};
            if (typeof callId != "string")
              continue;
            phase === "start" ? next.set(callId, event.time) : phase === "end" && next.delete(callId);
          } else event.type === "turn/end" && next.clear();
        return previous = window2, (next.size !== snapshot.size || [...next].some(([id, time]) => snapshot.get(id) !== time)) && (snapshot = next), snapshot;
      }
    };
  }
  function createVideoProgress({ React, h, TOKENS }) {
    function VideoTaskProgress({ block = {}, toolName = "video_generate", callId, useVideoExecutions, startedAt }) {
      let done = "kind" in block, executions = useVideoExecutions?.((snapshot) => snapshot), beganAt = startedAt ?? executions?.get(callId), [elapsed, setElapsed] = React.useState(0);
      if (React.useEffect(() => {
        if (done || beganAt === void 0)
          return;
        let tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - beganAt) / 1e3)));
        tick();
        let timer = window.setInterval(tick, 1e3);
        return () => window.clearInterval(timer);
      }, [done, callId, beganAt]), done || !["video_generate", "video_extend"].includes(toolName) || block.phase !== "start" || beganAt === void 0)
        return null;
      let status = "正在生成 · 等待结果", duration = block.args?.duration, estimatedWait = estimatedVideoWait(duration), progress = estimatedVideoProgress(elapsed, duration), waitingDots = ".".repeat(elapsed % 3 + 1), title = toolName === "video_extend" ? "视频续拍" : "视频生成";
      return h("div", { className: "mov-task mov-task-running", "data-field": "video-task-progress" }, [
        h("style", { key: "style" }, `
          @keyframes mov-task-spin { to { transform: rotate(360deg); } }
          @keyframes mov-task-flow { from { background-position:0 0; } to { background-position:32px 0; } }
          @keyframes mov-task-shimmer { from { transform:translateX(-120%); } to { transform:translateX(420%); } }
          @keyframes mov-task-pulse { 0%,100% { opacity:.45; } 50% { opacity:1; } }
          @keyframes mov-task-breath { 0%,100% { border-color:${TOKENS.border}; box-shadow:0 0 0 0 transparent; } 50% { border-color:${TOKENS.primaryFill}; box-shadow:0 0 12px 0 ${TOKENS.primaryFill}; } }
          .mov-task { box-sizing:border-box; min-width:0; width:100%; border:1px solid ${TOKENS.border}; border-radius:10px; padding:10px 12px; color:${TOKENS.text}; margin:6px 0; overflow-wrap:anywhere; }
          .mov-task-running { animation:mov-task-breath 2.4s ease-in-out infinite; }
          .mov-task-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:13px; }
          .mov-task-spinner { width:14px; height:14px; border:2px solid ${TOKENS.border}; border-top-color:${TOKENS.primaryFill}; border-radius:50%; animation:mov-task-spin .9s linear infinite; }
          .mov-task-note { font-size:12px; color:${TOKENS.muted}; margin-top:8px; }
          .mov-task-rail { position:relative; margin-top:20px; }
          .mov-task-track { height:5px; border-radius:999px; overflow:hidden; background:${TOKENS.border}; }
          .mov-task-turtle { position:absolute; top:-14px; transform:translateX(-50%) scaleX(-1); font-size:12px; line-height:1; transition:left 1s ease; }
          .mov-task-fill { height:100%; border-radius:999px; background:${TOKENS.primaryFill}; transition:width 1s ease; position:relative; overflow:hidden; }
          .mov-task-active .mov-task-fill { background-image:repeating-linear-gradient(110deg,transparent 0px,transparent 12px,rgba(255,255,255,.22) 12px,rgba(255,255,255,.22) 22px,transparent 22px,transparent 32px); background-size:32px 100%; animation:mov-task-flow 1s linear infinite; }
          .mov-task-active .mov-task-fill::after { content:''; position:absolute; inset:0; width:30%; background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent); animation:mov-task-shimmer 2s linear infinite; }
          .mov-task-live { display:inline-block; width:6px; height:6px; border-radius:50%; background:${TOKENS.primaryFill}; margin-right:6px; animation:mov-task-pulse 1.4s ease-in-out infinite; }
          .mov-task-dots { display:inline-block; width:18px; text-align:left; }
          @media(prefers-reduced-motion:reduce) { .mov-task-spinner, .mov-task-live, .mov-task-active .mov-task-fill, .mov-task-active .mov-task-fill::after { animation:none; } .mov-task-turtle { transition:none; } .mov-task-running { animation:none; } }
        `),
        h("div", { key: "head", className: "mov-task-head" }, [
          h("span", { key: "spinner", className: "mov-task-spinner", "aria-hidden": !0 }),
          h("strong", { key: "title" }, title),
          h("span", { key: "status", role: "status" }, [status, h("span", { key: "dots", className: "mov-task-dots", "aria-hidden": !0 }, waitingDots)]),
          h("span", { key: "elapsed", style: { marginLeft: "auto", fontVariantNumeric: "tabular-nums" } }, `已等待 ${Math.floor(elapsed / 60)}分${String(elapsed % 60).padStart(2, "0")}秒`)
        ]),
        h("div", { key: "progress", className: "mov-task-rail" }, [
          h("div", { className: "mov-task-track mov-task-active", role: "progressbar", "aria-label": "估算进度", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": progress }, h("div", { className: "mov-task-fill", style: { width: `${progress}%` } })),
          // 装饰用的小乌龟：跟着进度条填充的右端一起从左往右爬，只表示「还在忙」，不代表真实进度；屏幕阅读器不读它。
          h("span", { key: "turtle", className: "mov-task-turtle", style: { left: `${progress}%` }, "aria-hidden": !0 }, "🐢")
        ]),
        h("div", { key: "percent", className: "mov-task-note" }, `${progress}% · 估算进度`),
        h("div", { key: "note", className: "mov-task-note" }, [
          h("span", { key: "live", className: "mov-task-live", "aria-hidden": !0 }),
          `${duration ? `目标 ${duration} 秒 · 预计等待约 ${Math.round(estimatedWait)} 秒 · ` : ""}${progress >= 99 ? "任务仍在等待结果，进度停在99%不表示失败。" : "任务处理中，完成后自动显示结果。"}请勿重复提交。`
        ])
      ]);
    }
    function VideoProgressDock({ useChat, useVideoExecutions }) {
      let chat = useChat((snapshot) => snapshot), executions = useVideoExecutions?.((snapshot) => snapshot), calls = activeVideoCalls(chat).filter((call) => call.block.phase === "start" && executions?.has(call.callId));
      return calls.length ? h("div", {
        "data-field": "video-progress-dock",
        "aria-live": "polite",
        style: {
          boxSizing: "border-box",
          width: "calc(100% - var(--dsh-composer-side-clearance, 0px) - var(--dsh-composer-side-clearance, 0px))",
          maxWidth: "var(--dsh-composer-card-max-width, 100%)",
          minWidth: 0,
          margin: "0 auto",
          flex: "none"
        }
      }, calls.map((call) => h(VideoTaskProgress, { ...call, startedAt: executions.get(call.callId), key: call.callId }))) : null;
    }
    return { videoExecutionSource, VideoTaskProgress, VideoProgressDock };
  }

  // src/businesses/video-generation/connection-defaults.ts
  var METAONTIC_BASE_URL = RELAY.baseUrl, VOLCENGINE_MODE_AVAILABLE = VOLCENGINE.modeAvailable;
  function resolveImageModel(value) {
    let model = String(value ?? "").trim();
    return !model || RETIRED_IMAGE_MODELS.includes(model) ? IMAGE_MODEL : model;
  }
  function normalizeTextModel(value) {
    let model = String(value ?? "").trim();
    return !model || RETIRED_TEXT_MODELS.includes(model) ? TEXT_MODEL : model;
  }
  function connectionDefaults(values) {
    let text = (key, fallback) => String(values[key] ?? "").trim() || fallback, volc = values.connectionMode === "volcengine";
    return {
      ...volc ? { baseUrl: VOLCENGINE.baseUrl } : { baseUrl: text("baseUrl", METAONTIC_BASE_URL).replace(/\/+$/, "") },
      submitPath: volc ? VOLCENGINE.submitPath : text("submitPath", RELAY.submitPath),
      queryPath: volc ? VOLCENGINE.queryPath : text("queryPath", RELAY.queryPath),
      model: text("model", VIDEO_MODEL),
      imageModel: resolveImageModel(text("imageModel", IMAGE_MODEL)),
      textModel: normalizeTextModel(text("textModel", TEXT_MODEL)),
      imageUseVideoKey: values.imageUseVideoKey !== !1
    };
  }

  // src/businesses/video-generation/client/config.ts
  function createClientConfig() {
    let NAMESPACE = PLUGIN_NAMESPACE, NS = "settings.metaonticVideo", SELECTS = {
      // MetaOntic AI；火山直连按开关提供。
      connectionMode: VOLCENGINE_MODE_AVAILABLE ? ["metaontic", "volcengine"] : ["metaontic"],
      model: VIDEO_MODEL_OPTIONS,
      // 图片模型只提供在售的 pro 版；旧型号已下线，存量配置由 resolveImageModel 归一到这一项。
      imageModel: [IMAGE_MODEL],
      // 文本模型同样只列中转站当前上架的候选；旧默认值由 normalizeTextModel 归一到第一项。
      textModel: TEXT_MODELS,
      ratio: ["16:9", "9:16", "4:3", "3:4", "1:1", "adaptive"],
      mergeMode: ["copy", "reencode"]
    }, SECTIONS = [
      { key: "sectionConnection", fields: ["connectionMode"] },
      { key: "sectionModels", fields: ["imageUseVideoKey", "model", "metaonticApiKey", "volcengineApiKey", "imageModel", "imageApiKey", "textModel", "textApiKey"] },
      { key: "sectionInterface", fields: ["sidebarAssistantEnabled"] },
      { key: "sectionVideo", fields: ["ratio", "generateAudio"] },
      ...FLOW_CANVAS_AVAILABLE ? [{ key: "sectionCanvas", fields: ["canvasEnabled", "autoCreateCanvas"] }] : []
    ], FIELD_BY_KEY = Object.fromEntries([
      { key: "sidebarAssistantEnabled", kind: "switch", wide: !0 },
      { key: "connectionMode", kind: "select", wide: !0 },
      { key: "metaonticApiKey", kind: "text", secret: !0, wide: !0 },
      { key: "volcengineApiKey", kind: "text", secret: !0, wide: !0 },
      // 模型用下拉选（候选见 MODEL_OPTIONS），占一整行显示完整型号
      { key: "model", kind: "select", wide: !0 },
      { key: "imageModel", kind: "select", wide: !0 },
      // 文本模型（写脚本）：与视频模型同一把密钥，候选见 SELECTS（TEXT_MODELS）
      { key: "textModel", kind: "select", wide: !0 },
      { key: "imageUseVideoKey", kind: "switch", wide: !0 },
      { key: "imageApiKey", kind: "text", secret: !0, wide: !0 },
      { key: "textApiKey", kind: "text", secret: !0, wide: !0 },
      { key: "ratio", kind: "select" },
      { key: "generateAudio", kind: "switch" },
      { key: "watermark", kind: "switch" },
      { key: "usageStatsEnabled", kind: "switch" },
      // 流程画布总开关；打开后设置页才显示「自动创建画布」这一项。
      { key: "canvasEnabled", kind: "switch", wide: !0 },
      { key: "autoCreateCanvas", kind: "switch", wide: !0 },
      { key: "seamTrimSeconds", kind: "text" },
      { key: "mergeMode", kind: "select", wide: !0 },
      { key: "pollIntervalMs", kind: "number" },
      { key: "maxWaitMs", kind: "number" },
      { key: "ffmpegBinary", kind: "text", mono: !0 },
      { key: "ffprobeBinary", kind: "text", mono: !0 }
    ].map((field) => [field.key, field])), PLUGIN_OWNED_KEYS = [
      "sidebarAssistantEnabled",
      "canvasEnabled",
      "autoCreateCanvas",
      "usageStatsEnabled",
      "connectionMode",
      "metaonticApiKey",
      "volcengineApiKey",
      "entryId",
      "baseUrl",
      "submitPath",
      "queryPath",
      "imageUseVideoKey",
      "imageApiKey",
      "imageModel",
      "textModel",
      "textApiKey",
      "model",
      "estimateGroupRatio",
      "duration",
      "singleMaxSeconds",
      "seamTrimSeconds",
      "mergeMode",
      "bgmFadeSeconds",
      "outputDir",
      "keepSegments",
      "resumeLockStaleMinutes",
      "ffmpegBinary",
      "ffprobeBinary",
      "mode",
      "ratio",
      "generateAudio",
      "watermark",
      "extraParams",
      "pollIntervalMs",
      "maxWaitMs",
      "pollErrorRetries"
    ];
    function formatMoney(value) {
      let number = Number(value);
      if (!Number.isFinite(number)) return "0";
      let text = number.toFixed(Math.abs(number) >= 1 ? 2 : 4);
      return text.includes(".") ? text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : text;
    }
    function optionLabel(t, key, option) {
      return key === "connectionMode" ? t(option) : key === "mergeMode" ? t(option === "reencode" ? "mergeModeReencode" : option === "copy" ? "mergeModeCopy" : "mergeModeSeamless") : option;
    }
    return { PLUGIN_OWNED_KEYS, SELECTS, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, NS, NAMESPACE };
  }

  // src/businesses/video-generation/client/locale.ts
  function createDictionaries() {
    return { zh: {
      connectionCheckTitle: "API 连接验证",
      connectionCheckButton: "验证连接",
      connectionChecking: "正在验证…",
      connectionCheckSaveFirst: "有未保存的修改，请先保存后验证。",
      connectionCheckHint: "检查已保存的接口、鉴权响应和模型清单，不提交生成任务、不产生模型生成费用；通过不代表实际生成效果已验证。",
      connectionCheckFailed: "验证未完成，请确认插件服务可用后重试。",
      connectionTarget_video: "视频模型",
      connectionTarget_image: "图片模型",
      connectionTarget_text: "文本模型",
      connectionResult_ok: "鉴权接口响应正常，当前模型已列出。",
      connectionResult_model_not_listed: "接口响应正常，但当前模型未列出，请核对模型名称与使用权限。",
      connectionResult_key_missing: "未填写此模型实际使用的 API密钥，请填写并保存。",
      connectionResult_invalid_address: "接口地址格式不正确，请检查已保存的地址。",
      connectionResult_auth_failed: "鉴权未通过（401），请核对 API密钥及接口地址。",
      connectionResult_forbidden: "只读验证接口被拒绝（403），尚不能据此判断生成权限，请核对渠道接口限制。",
      connectionResult_auth_reachable: "密钥鉴权正常；渠道限制了模型清单查询，当前模型生成权限尚未验证。",
      connectionResult_models_unsupported: "服务未提供模型查询接口，无法仅靠只读请求确认可用性。",
      connectionResult_rate_limited: "请求受限（429），请稍后重试并核对渠道限制。",
      connectionResult_server_error: "上游接口异常，请核对地址或稍后重试。",
      connectionResult_invalid_response: "返回内容不是预期的模型清单，请检查接口地址。",
      connectionResult_api_rejected: "上游拒绝了验证请求，请核对 API密钥和地址。",
      connectionResult_timeout: "连接超时，请检查网络和接口地址后重试。",
      connectionResult_network_error: "无法连接接口，请检查网络、证书或接口地址。",
      connectionResult_query_reachable: "查询接口已响应；只读探测尚不能确认当前模型的生成权限。",
      connectionResult_query_unverified: "只读查询未能确认连接，请核对火山接口配置及权限。",
      summaryEmpty: "请选择接入方式，填写 API密钥后保存。",
      panelTitle: "视频创作",
      panelSidebarLabel: "视频创作助手",
      sidebarUpdateBadge: "有更新",
      panelIntro: "在对话里说清创意、时长与画幅，脚本、分镜、生成和本机合并都由插件完成。",
      panelStart: "开始创作",
      panelNew: "新建视频创作会话",
      panelSettings: "打开插件设置",
      panelGuide: "使用说明",
      panelHighlights: "为什么用它",
      panelHighlight1Title: "新手也能上手",
      panelHighlight1Desc: "不用研究提示词：说清创意、时长和画幅就能开始，脚本、分镜、生成和本机合并都由助手完成。",
      panelHighlight2Title: "分段制作长视频",
      panelHighlight2Desc: "超过单段上限时分段续拍，每段预览确认后继续，全部完成后在本机合并。",
      panelFlow: "使用流程",
      panelStep1Title: "说清创意",
      panelStep1Desc: "主题、时长、画幅（16:9 / 9:16）与清晰度；没写画幅时助手会先问。",
      panelStep2Title: "脚本分镜",
      panelStep2Desc: "先出脚本与分镜，你审核确认后再继续。",
      panelStep3Title: "逐段生成",
      panelStep3Desc: "确认费用后生成；分段预览确认后继续下一段，支持断点续做。",
      panelStep4Title: "本机合并",
      panelStep4Desc: "分段生成的结果在本机合并成片，可逐段预览。",
      summary: "{provider} · {model}",
      apiKeyConfigured: "已配置，留空保留现有 API密钥",
      connectionMode: "接入方式",
      connectionModeHint: "使用自己的 MetaOntic AI API密钥。切换后保存生效。",
      connectionVolcengineUnavailable: "火山引擎直连当前暂不提供选择：已有的配置仍可继续生成；如需更换，请在「接入方式」里选择 MetaOntic AI。",
      connectionMetaonticHint: "使用 MetaOntic AI 的 API密钥，填写后保存生效。",
      connectionMetaonticRegister: "注册获取 API密钥",
      volcengineKeyHint: "填写火山方舟控制台的 API密钥后保存，费用由火山引擎账户承担。需要自行核对好 API密钥的模型能力。",
      metaontic: "MetaOntic AI",
      metaonticApiKey: "MetaOntic AI API密钥",
      showKey: "显示 API密钥",
      hideKey: "隐藏 API密钥",
      metaonticKeyHint: "填写 API密钥后保存，无需邮箱登录。按实际调用计费，费用与用量请在渠道平台查看。",
      volcengineApiKey: "火山引擎 API密钥",
      volcengine: "火山引擎直连",
      volcengineUnavailable: "火山引擎直连（暂不提供选择）",
      seamTrimSeconds: "接缝裁剪秒数（如 0.5,0）",
      modelHiddenCurrent: "当前模型（暂不提供选择）",
      releaseNotesTitle: "更新内容",
      releaseUpdatedAt: "{time}",
      resetConfirm: "确定重置插件吗？这会清除本插件保存的配置和API密钥，需要重新配置。已生成的视频不会删除。",
      model: "视频模型",
      imageModel: "图片模型",
      textModel: "文本模型（写脚本）",
      imageUseVideoKey: "视频 / 图片 / 文本模型共用 API密钥",
      sharedModelKey: "共用 API密钥",
      videoModelKey: "视频模型 API密钥",
      imageApiKey: "图片模型 API密钥",
      textApiKey: "文本模型 API密钥",
      resolution: "视频清晰度",
      imageModelHint: "Seedream可生成角色图；遇真人限制时，经同意可转换参考图。图片调用单独计费，结果需审核。",
      textModelHint: "保留配置：流程画布暂隐藏，对话写脚本使用Harness会话模型。原画布「创作流程」里用这个型号把一段想法写成剧本与分镜表；走同一中转站的 /v1/chat/completions，单独按文本计费。候选与中转站在售的文本模型一致，旧的默认型号已下线，读到会自动换成默认项。",
      modelHint: "mini 侧重成本，fast 侧重生成速度。实际价格以所选渠道为准。",
      mergeMode: "合并方式",
      mergeModeSeamless: "直接拼接（旧配置兼容）",
      mergeModeCopy: "无损拼接",
      mergeModeReencode: "重编码拼接",
      ffmpegBinary: "ffmpeg 路径",
      ffprobeBinary: "ffprobe 路径",
      ffmpegTitle: "长视频合并需要 ffmpeg",
      ffmpegBody: "视频超过模型单次上限（2.0 为 15 秒、2.5 为 30 秒）时会拆成几段分别生成、再在本机合并成一条——合并这一步用的是 ffmpeg。默认合并前会检查是否安装；明确选择只生成分段时可不合并。",
      ffmpegInstallFor: "按你的系统装一下（点右边按钮复制命令）：",
      ffmpegCopy: "复制",
      ffmpegCopied: "已复制",
      ffmpegMore: "其他系统",
      ffmpegLess: "收起其他系统",
      ffmpegAfter: "不想自己敲命令的话，直接在对话里说「帮我装 ffmpeg」——插件会执行安装（命令会先让你确认）；装好后用原暂停进度重试下载或合并，不重新提交视频生成。ffmpeg 装在非默认位置的话，把绝对路径填到上面的「ffmpeg 路径」也一样管用。安装包自带 ffprobe，分段时长探测会一起解决。",
      ffmpegManual: "想自己装：macOS 用 Homebrew，Windows 用 winget，Linux 用系统包管理器；装完确认命令行里能跑 ffmpeg -version 就行。",
      supportContact: "客服",
      advancedStats: "使用统计",
      usageStatsEnabled: "匿名使用统计",
      usageStatsHint: "用于统计首次启用、启动和功能使用情况，仅上报匿名标识、版本、基础设备信息与调用结果，不含对话、素材或API密钥。关闭不影响视频创作。",
      toolArgsNoticeTitle: "这一轮助手把工具参数写成了不合法的 JSON",
      toolArgsNoticeHint: "多半是 480p、16:9 这类值少了引号，本轮没有真正调用工具、也没有产生费用；回一句「按原参数重试」即可，助手会补齐引号按原来的清晰度、画幅和时长重发。",
      authNoticeTitle: "服务连接验证未通过",
      authNoticeHint: "请到 Harness 的模型设置检查当前 API密钥和中转地址；如果配置无误，请联系客服核查。",
      supportClose: "关闭",
      supportScan: "请按页面提示使用微信联系客服，咨询使用或接入问题。页面未加载时可点击下方链接。",
      supportOpenPage: "打开客服页面",
      versionTitle: "插件版本",
      versionCurrent: "当前版本 v{version}",
      versionCheck: "检查更新",
      versionChecking: "检查中…",
      versionLatest: "已是最新版本",
      versionNew: "有新版本 v{version}",
      versionFailed: "检查更新失败：{message}",
      versionUpdate: "立即更新",
      versionOptional: "这是普通更新，你可以自行决定是否升级。稍后处理不影响继续使用，插件不会自动安装。",
      versionLater: "稍后再说",
      versionUpdateConfirm: "确认更新到 v{version}",
      versionUpdateConfirmHint: "更新期间设置页可能短暂关闭，现有配置与 API密钥会保留。",
      versionUpdating: "更新中…",
      versionUpdateDone: "已更新到 v{version}，已通过热加载生效，无需重启。现有对话下一轮使用最新插件规则。",
      versionUpdatePending: "v{version} 已安装，当前配置尚未启用新版，请在插件页检查启用状态。",
      versionUpdateRestart: "新版本 v{version} 已装好：重启 Harness 后生效。",
      versionUpdateCancelled: "更新已取消。",
      versionUpdateRetry: "更新未完成，正在重试（{attempt}/{total}）…",
      versionUpdateFailed: "在线更新失败：{message}",
      versionUpdateRemoved: "未能确认插件安装状态，请到「插件」页检查；保留现有配置，不要直接卸载。",
      versionUpdateRateLimited: "Gitee 请求过于频繁，请稍后重试。现有配置与 API密钥会保留。",
      versionUpdateLockfile: "安装目录的 pnpm-lock.yaml 里有本插件缺少 integrity 的旧记录，pnpm 因此拒绝安装（ERR_PNPM_MISSING_TARBALL_INTEGRITY）。插件会每 2 秒检查一次、自动清理这些无效记录并保留备份，更新失败后也会等清理完成自动重试；若仍然失败，完全退出 Harness 后手动删除插件安装目录下的 pnpm-lock.yaml 再试。",
      versionUpdateUnavailable: "当前 Harness 不支持此在线更新入口，请保留现有插件与配置，参考使用说明通过正式版成品包更新。",
      versionHint: "可在此检查并安装新版本，现有配置与 API密钥会保留。",
      versionCheckedAt: "检查于 {time}",
      sectionGeneration: "生成参数",
      sectionConnection: "接入与 API密钥",
      sectionVideo: "画面与声音",
      sectionInterface: "界面显示",
      sidebarAssistantEnabled: "显示左侧视频创作助手",
      sidebarAssistantEnabledHint: "默认开启。保存后立即显示或隐藏左侧入口；已有会话、视频任务和插件设置入口保留。",
      sectionCanvas: "流程画布",
      canvasPanelLabel: "MetaOnticVideo流程画布",
      canvasEnabled: "流程画布",
      canvasEnabledHint: "默认关闭：关闭时左侧栏不出现「MetaOnticVideo流程画布」入口，画布不可用；已有画布与成果仍保留在插件数据目录，重新打开就能继续。开启后左侧栏出现流程画布入口，可用独立画布页创作。流程画布是本插件自带组件，不需要安装其他画布插件。",
      autoCreateCanvas: "自动创建画布",
      autoCreateCanvasHint: "流程画布打开后有效，默认开启：创作时自动建图，审核前同步剧本、分镜和制作计划，生成后回填成果；关闭后不自动建图，仅在画布内明确选中节点时联动。",
      sectionModels: "模型配置",
      sectionCombined: "更多设置",
      advancedPicture: "画面",
      advancedMerge: "视频合并",
      advancedWait: "查询与等待",
      advancedTools: "本地工具",
      sectionCombinedHint: "画面 · 合并 · 等待 · 本地工具",
      toolsHint: "通常无需填写；已安装但无法自动识别时，可指定可执行文件路径。",
      segmentsRetained: "所有原始分段自动保留，便于预览、续做和重新剪辑。",
      ratio: "画面比例",
      audioSettings: "声音设置",
      ratioLayoutHint: "选择横屏、竖屏或自动适配画面。",
      audioLayoutHint: "对白、音乐与环境声按脚本安排。",
      generateAudio: "生成音频",
      watermark: "添加水印",
      pollIntervalMs: "状态查询间隔（秒）",
      maxWaitMs: "单个任务最长等待时间（秒）",
      save: "保存",
      reset: "重置插件",
      resetHint: "清除本机保存的 API密钥与自定义设置，恢复默认配置。",
      saving: "保存中…",
      saved: "设置已保存，配置重新加载后生效。",
      saveFailed: "保存失败，请检查设置后重试。",
      dirty: "有未保存的改动",
      loading: "读取配置中…",
      unavailable: "暂时无法加载插件设置，请重启 Harness 后重试；若仍无法加载，请检查 Harness 与插件的版本是否兼容。",
      readOnly: "当前配置为只读，无法保存修改。",
      seamTrimSecondsHint: "分别裁剪第 2、3…段开头，例如 0.5,0。留空使用模型默认值，填 0 关闭；每项为 0–3 秒。",
      waitSecondsHint: "至少 1 秒，支持小数。最长等待时间不得小于查询间隔。",
      versionHistory: "历史更新",
      versionCheckFirst: "请先检查并选择可用的正式版本，再确认安装。",
      unknownConnection: "未知接入方式，请重新选择。",
      atomicUnsupported: "当前 Harness 不支持批量保存，请更新 Harness 后重试。",
      atomicRejected: "软件未接受本次保存，输入已保留。请重新打开设置页核对后重试。",
      settingsUnavailable: "设置页正在加载或已更新，输入已保留。请重新打开设置页后重试。",
      settingsConflict: "配置同时被其他操作修改，输入已保留。请核对最新设置后重试。",
      settingsTransport: "保存连接中断，结果尚未确认。输入已保留，请重新打开设置页核对后再保存。",
      invalidWait: "等待时间须为至少 1 秒的有效数值，且最长等待时间不得小于查询间隔。",
      invalidSeam: "接缝裁剪须为逗号分隔的 0–3 秒数值，例如 0.5,0。",
      resetDone: "已清除本机配置，恢复默认设置。",
      resetFailed: "重置失败：{message}"
    }, en: {
      connectionCheckTitle: "API connection check",
      connectionCheckButton: "Check connection",
      connectionChecking: "Checking…",
      connectionCheckSaveFirst: "Save your changes before checking.",
      connectionCheckHint: "Checks saved endpoints, authentication responses and model listings without submitting generation tasks or incurring model generation charges. Success does not verify generation quality.",
      connectionCheckFailed: "Check could not finish. Confirm the plugin service is available and retry.",
      connectionTarget_video: "Video model",
      connectionTarget_image: "Image model",
      connectionTarget_text: "Text model",
      connectionResult_ok: "Authentication endpoint responded and the model is listed.",
      connectionResult_model_not_listed: "Endpoint responded, but this model is not listed. Check its name and permissions.",
      connectionResult_key_missing: "The API key used by this model is missing. Enter it and save.",
      connectionResult_invalid_address: "Invalid endpoint address. Check the saved URL.",
      connectionResult_auth_failed: "Authentication failed (401). Check the API key and endpoint.",
      connectionResult_forbidden: "Read-only check denied (403). Generation permissions remain unverified; check provider endpoint restrictions.",
      connectionResult_auth_reachable: "Key authentication responded successfully; model listing is restricted. Generation permissions remain unverified.",
      connectionResult_models_unsupported: "Model listing is unsupported. Read-only checks cannot confirm availability.",
      connectionResult_rate_limited: "Rate limited (429). Retry later and check provider limits.",
      connectionResult_server_error: "Upstream error. Check the endpoint or retry later.",
      connectionResult_invalid_response: "Unexpected model listing response. Check the endpoint URL.",
      connectionResult_api_rejected: "Upstream rejected the check. Check the API key and endpoint.",
      connectionResult_timeout: "Connection timed out. Check the network and endpoint.",
      connectionResult_network_error: "Connection failed. Check the network, certificates and endpoint.",
      connectionResult_query_reachable: "Query endpoint responded. Generation permissions remain unverified.",
      connectionResult_query_unverified: "Read-only query was inconclusive. Check the Volcano endpoint and permissions.",
      summaryEmpty: "Choose a connection method, then log in or enter an API key and save.",
      panelTitle: "Video",
      panelSidebarLabel: "Video Creator",
      sidebarUpdateBadge: "Update available",
      panelIntro: "Describe the idea, duration and aspect ratio in the conversation; the plugin handles script, storyboard, generation and local merging.",
      panelStart: "Start creating",
      panelNew: "New video session",
      panelSettings: "Open plugin settings",
      panelGuide: "User guide",
      panelHighlights: "Why it works",
      panelHighlight1Title: "Made for beginners",
      panelHighlight1Desc: "No prompt engineering: describe the idea, duration and ratio, and the assistant handles script, storyboard, generation and merging.",
      panelHighlight2Title: "Create longer videos in segments",
      panelHighlight2Desc: "Videos beyond the model limit are continued in segments. Review each segment before continuing; merge locally when all segments are complete.",
      panelFlow: "How it works",
      panelStep1Title: "Describe the idea",
      panelStep1Desc: "Topic, duration, ratio (16:9 / 9:16) and resolution; the assistant asks when the ratio is missing.",
      panelStep2Title: "Script & storyboard",
      panelStep2Desc: "The script and storyboard come first; production waits for your review.",
      panelStep3Title: "Segment generation",
      panelStep3Desc: "Confirm the cost to generate, then review each segment before continuing to the next. Resume saved progress when needed.",
      panelStep4Title: "Merge locally",
      panelStep4Desc: "Segments are merged into the final video on your machine, with per-segment preview.",
      summary: "{provider} · {model}",
      apiKeyConfigured: "Configured; leave blank to keep the current key",
      connectionMode: "Connection",
      connectionModeHint: "Log in by email to receive a key, or use your own MetaOntic AI key. Save to apply a change.",
      connectionVolcengineUnavailable: 'Volcano Engine direct is not offered right now. An existing configuration keeps working; switch to MetaOntic AI in "Connection" to change it.',
      connectionMetaonticHint: "Use your MetaOntic AI API key, then save to apply.",
      connectionMetaonticRegister: "Register to get a key",
      volcengineKeyHint: "Enter an API key from the Volcano Ark console and save. No email login required. Billed to your Volcano Engine account. Check which models your key can access.",
      metaontic: "MetaOntic AI",
      metaonticApiKey: "MetaOntic AI API key",
      showKey: "Show key",
      hideKey: "Hide key",
      metaonticKeyHint: "Enter an API key and save. No email login required. Check actual charges and usage on your provider platform.",
      volcengineApiKey: "Volcano Engine API key",
      volcengine: "Volcano Engine",
      volcengineUnavailable: "Volcano Engine (not offered right now)",
      seamTrimSeconds: "Seam head trims (e.g. 0.5,0)",
      modelHiddenCurrent: "Current model (selection unavailable)",
      releaseNotesTitle: "Release notes",
      releaseUpdatedAt: "{time}",
      resetConfirm: "Reset this plugin? Saved settings, API keys and login state will be cleared. Generated videos will be kept.",
      model: "Video model",
      imageModel: "Image model",
      textModel: "Text model (scripting)",
      imageUseVideoKey: "Share one API key across video / image / text models",
      sharedModelKey: "Shared key",
      videoModelKey: "Video model key",
      imageApiKey: "Image model key",
      textApiKey: "Text model key",
      resolution: "Video resolution",
      imageModelHint: "Seedream creates character images or, with consent after a real-person restriction, stylizes references. Image calls are billed separately and results require review.",
      textModelHint: "Retained configuration: the workflow canvas is temporarily hidden; chat scripting uses the Harness session model. Previously used inside the canvas flow panel to turn a brief into a script and storyboard table through the same relay (/v1/chat/completions); text calls are billed separately. Options match the text models on sale at the relay; the retired default is replaced with the current default.",
      modelHint: "mini focuses on cost; fast focuses on generation speed. Actual prices depend on your provider.",
      mergeMode: "Merge mode",
      mergeModeSeamless: "Direct concat (legacy setting)",
      mergeModeCopy: "Stream copy",
      mergeModeReencode: "Re-encode",
      ffmpegBinary: "ffmpeg path",
      ffprobeBinary: "ffprobe path",
      ffmpegTitle: "Merging long videos needs ffmpeg",
      ffmpegBody: "Videos exceeding the model limit (15s for 2.0, 30s for 2.5) are generated as several shots and merged into one file on this machine using ffmpeg. The default merge workflow checks for ffmpeg first; you may explicitly choose separate segments without merging.",
      ffmpegInstallFor: "Install it for your OS (click the button to copy the command):",
      ffmpegCopy: "Copy",
      ffmpegCopied: "Copied",
      ffmpegMore: "Other systems",
      ffmpegLess: "Hide other systems",
      ffmpegAfter: 'Rather not touch a terminal? Just say "帮我装 ffmpeg" in the chat and the plugin runs the install after you confirm the command. Resume the original saved progress to retry downloading or merging without submitting new generation tasks. Installed somewhere unusual? Put the absolute path in the "ffmpeg path" field above. The package ships ffprobe too, so segment probing is fixed at the same time.',
      ffmpegManual: "Installing by hand: Homebrew on macOS, winget on Windows, your distro package manager on Linux — you are set once `ffmpeg -version` works in a terminal.",
      supportContact: "Support",
      advancedStats: "Usage statistics",
      usageStatsEnabled: "Anonymous usage statistics",
      usageStatsHint: "Reports an anonymous installation ID, version, basic device information and operation results. No conversations, media or API keys. Turning it off does not affect video creation.",
      toolArgsNoticeTitle: "The assistant wrote invalid JSON for a tool call",
      toolArgsNoticeHint: "Usually a value like 480p or 16:9 is missing its quotes. Nothing was executed and nothing was billed; reply “retry with the same settings” and the assistant will re-send with the same resolution, aspect ratio and duration.",
      authNoticeTitle: "Service authentication could not be verified",
      authNoticeHint: "Check the API key and relay URL in Harness model settings. If they are correct, contact support.",
      supportClose: "Close",
      supportScan: "Follow the page instructions to contact support with WeChat for usage or connection questions. If it does not load, use the link below.",
      supportOpenPage: "Open support page",
      versionTitle: "Plugin version",
      versionCurrent: "Installed v{version}",
      versionCheck: "Check for updates",
      versionChecking: "Checking…",
      versionLatest: "Up to date",
      versionNew: "v{version} is available",
      versionFailed: "Update check failed: {message}",
      versionUpdate: "Update now",
      versionOptional: "This update is optional. You can keep using the plugin and update later. It will not install automatically.",
      versionLater: "Later",
      versionUpdateConfirm: "Confirm update to v{version}",
      versionUpdateConfirmHint: "The settings page may briefly close during the update. Your settings and keys will be kept.",
      versionUpdating: "Updating…",
      versionUpdateDone: "v{version} applied through hot reload; no restart needed. Existing conversations use updated plugin rules on the next turn.",
      versionUpdatePending: "v{version} installed, but not activated by the current configuration. Check its enabled state in Plugins.",
      versionUpdateRestart: "v{version} installed; restart Harness to apply it.",
      versionUpdateCancelled: "Update cancelled.",
      versionUpdateRetry: "Update incomplete. Retrying ({attempt}/{total})…",
      versionUpdateFailed: "Online update failed: {message}",
      versionUpdateRemoved: "The installation state could not be confirmed. Check the Plugins page and preserve your configuration; do not uninstall immediately.",
      versionUpdateRateLimited: "Gitee is limiting requests. Try again later. Your settings and keys will be kept.",
      versionUpdateLockfile: "The profile pnpm-lock.yaml still has metaontic-video entries without integrity, so pnpm refuses to install (ERR_PNPM_MISSING_TARBALL_INTEGRITY). The plugin checks every 2 seconds, clears those invalid entries in the background and keeps a backup, and the update retries once the cleanup is done. If it still fails, quit Harness and delete pnpm-lock.yaml in the plugin install directory.",
      versionUpdateUnavailable: "This Harness version does not support this update entry. Keep the existing plugin and configuration; follow the guide to update using a stable release package.",
      versionHint: "Check for and install updates here. Your settings and keys will be kept.",
      versionCheckedAt: "checked {time}",
      sectionGeneration: "Generation",
      sectionConnection: "Connection & credentials",
      sectionVideo: "Picture & audio",
      sectionInterface: "Interface",
      sidebarAssistantEnabled: "Show video assistant in sidebar",
      sidebarAssistantEnabledHint: "On by default. Saving shows or hides the sidebar entry immediately. Existing conversations, video tasks and plugin settings remain available.",
      sectionCanvas: "Workflow canvas",
      canvasPanelLabel: "MetaOnticVideo workflow canvas",
      canvasEnabled: "Workflow canvas",
      canvasEnabledHint: "Off by default: the sidebar shows no workflow canvas entry and the canvas is unavailable. Existing canvases and results stay in the plugin data folder and reopen where they left off. Turn it on to show the entry and use the standalone canvas page. The workflow canvas is built into this plugin; no other canvas plugin is required.",
      autoCreateCanvas: "Create canvas automatically",
      autoCreateCanvasHint: "Effective once the workflow canvas is on, on by default: each project creates a canvas automatically, syncs script, storyboard and plan before review, and publishes results after generation. Turn it off to stop automatic creation and only act on nodes you select.",
      sectionModels: "Models",
      sectionCombined: "More settings",
      advancedPicture: "Picture",
      advancedMerge: "Video merging",
      advancedWait: "Polling & waiting",
      advancedTools: "Local tools",
      sectionCombinedHint: "Appearance, merging, runtime and local tools",
      toolsHint: "Usually leave blank. Set executable paths only if installed tools are not detected.",
      segmentsRetained: "Original segments are always retained for preview, resume and editing.",
      ratio: "Aspect ratio",
      audioSettings: "Audio settings",
      ratioLayoutHint: "Choose landscape, portrait or adaptive framing.",
      audioLayoutHint: "Dialogue, music and ambience follow the script.",
      generateAudio: "Generate audio",
      watermark: "Add watermark",
      pollIntervalMs: "Status check interval (seconds)",
      maxWaitMs: "Maximum wait per task (seconds)",
      save: "Save",
      reset: "Reset plugin",
      resetHint: "Clear locally saved keys and custom settings to restore defaults.",
      saving: "Saving…",
      saved: "Settings saved. Changes apply after configuration reloads.",
      saveFailed: "Could not save. Check your settings and try again.",
      dirty: "Unsaved changes",
      loading: "Reading configuration…",
      unavailable: "Plugin settings could not be loaded. Restart Harness and try again. If this continues, check that your Harness and plugin versions are compatible.",
      readOnly: "These settings are read-only and cannot be changed.",
      seamTrimSecondsHint: "Trim the start of segments 2, 3, etc., e.g. 0.5,0. Leave blank for model defaults; use 0 to disable. Each value: 0–3 seconds.",
      waitSecondsHint: "At least 1 second; decimals allowed. Maximum wait must be at least the check interval.",
      versionHistory: "Update history",
      versionCheckFirst: "Check and select an available stable version before confirming installation.",
      unknownConnection: "Unknown connection method. Select one again.",
      atomicUnsupported: "This version of Harness does not support batch saving. Update Harness and try again.",
      atomicRejected: "The application refused the save. Input is retained. Reopen settings, review and retry.",
      settingsUnavailable: "Settings are loading or were replaced. Input is retained. Reopen settings and retry.",
      settingsConflict: "Another operation changed these settings. Input is retained. Review the latest settings and retry.",
      settingsTransport: "The save connection was interrupted; the result is unconfirmed. Input is retained. Reopen settings and check before saving again.",
      invalidWait: "Enter valid times of at least 1 second. Maximum wait must be at least the check interval.",
      invalidSeam: "Enter comma-separated trim values from 0 to 3 seconds, e.g. 0.5,0.",
      resetDone: "Local settings cleared and defaults restored.",
      resetFailed: "Reset failed: {message}"
    } };
  }

  // src/platform/settings/state.ts
  function createFormState({ React }) {
    function useSnapshot(form) {
      let subscribe = React.useCallback((listener) => form.subscribe(listener), [form]), getSnapshot = React.useCallback(() => form.getSnapshot(), [form]);
      return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    }
    function same(a, b) {
      return a === b || a === void 0 && b === "" || a === "" && b === void 0;
    }
    async function persistBatch(form, ops) {
      if (typeof form.mutate != "function") throw new Error("atomicUnsupported");
      function checkpoint() {
        try {
          let snapshot = form.getSnapshot?.();
          if (!snapshot || snapshot.status !== "ready" || snapshot.writable === !1 || snapshot.revision == null) return null;
          let fields = ops.map(({ path }) => ["value", "user", "base", "secrets"].map((source) => {
            let current = snapshot[source];
            for (let key of path) current = current?.[key];
            return current;
          }));
          return { revision: snapshot.revision, fields: JSON.stringify(fields) };
        } catch {
          return null;
        }
      }
      function fail(code, before2, after2) {
        throw globalThis.console?.warn?.("[MetaOnticVideo] settings-save", {
          code,
          beforeRevision: before2?.revision ?? null,
          afterRevision: after2?.revision ?? null
        }), new Error(code);
      }
      function readiness() {
        let snapshot;
        try {
          snapshot = form.getSnapshot?.();
        } catch {
          return "settingsUnavailable";
        }
        return snapshot ? snapshot.writable === !1 ? "readOnly" : snapshot.status && snapshot.status !== "ready" ? "settingsUnavailable" : null : null;
      }
      let initialProblem = readiness();
      initialProblem && fail(initialProblem, null, null);
      let before = checkpoint(), accepted;
      try {
        accepted = await form.mutate(ops, before?.revision);
      } catch {
        fail("settingsTransport", before, null);
      }
      if (accepted) return;
      let after = checkpoint(), problem = readiness();
      if (problem && fail(problem, before, after), before && after && before.revision !== after.revision) {
        before.fields !== after.fields && fail("settingsConflict", before, after);
        try {
          accepted = await form.mutate(ops, after.revision);
        } catch {
          fail("settingsTransport", after, null);
        }
        if (accepted) return;
        let latest = checkpoint();
        fail(readiness() || (latest && latest.revision !== after.revision ? "settingsConflict" : "atomicRejected"), after, latest);
      }
      fail("atomicRejected", before, after);
    }
    return { useSnapshot, same, persistBatch };
  }

  // src/businesses/video-generation/client/state.ts
  function createSettingsState({ React }) {
    let { useSnapshot, same, persistBatch } = createFormState({ React });
    function validateSettings(values) {
      let interval = Number(values.pollIntervalMs ?? 5e3), wait = Number(values.maxWaitMs ?? 6e5);
      if (![interval, wait].every((n) => Number.isSafeInteger(n) && n >= 1e3) || wait < interval)
        throw new Error("invalidWait");
      let trim = String(values.seamTrimSeconds ?? "").trim();
      if (trim && !trim.split(",").every((part) => part.trim() !== "" && Number.isFinite(Number(part)) && Number(part) >= 0 && Number(part) <= 3))
        throw new Error("invalidSeam");
    }
    async function persistConnection(form, pending, nextMode) {
      if (!["metaontic", "volcengine"].includes(nextMode)) throw new Error("unknownConnection");
      let inactiveKeys = nextMode === "volcengine" ? ["metaonticApiKey", "baseUrl", "submitPath", "queryPath"] : ["volcengineApiKey"], ops = pending.filter(([key]) => key !== "connectionMode" && !inactiveKeys.includes(key)).map(([key, next]) => ({ op: "set", path: [key], value: next }));
      for (let key of inactiveKeys) ops.push({ op: "set", path: [key], value: "" });
      let saved = form.getSnapshot?.()?.value || {}, values = { ...saved, ...Object.fromEntries(pending), connectionMode: nextMode };
      if (saved.connectionMode === "volcengine" && nextMode !== "volcengine")
        for (let key of ["baseUrl", "submitPath", "queryPath"])
          pending.some(([field]) => field === key) || (values[key] = "");
      for (let key of inactiveKeys) values[key] = "";
      for (let [key, next] of Object.entries(connectionDefaults(values))) {
        let existing = ops.findIndex((op) => op.path[0] === key);
        existing >= 0 && ops.splice(existing, 1), ops.push({ op: "set", path: [key], value: next });
      }
      ops.push({ op: "set", path: ["connectionMode"], value: nextMode }), await persistBatch(form, ops);
    }
    return { useSnapshot, same, validateSettings, persistConnection, persistBatch };
  }

  // src/ui/updates/update.service.ts
  function createUpdates({ h, fetchSource }) {
    let PLUGIN_VERSION = "4.0.11".trim().replace(/^v/i, "");
    function isNewerVersion(remote, local) {
      let parse = (text) => {
        let m = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(String(text || ""));
        return m ? { core: m.slice(1, 4).map(Number), pre: m[4]?.split(".") || [] } : null;
      }, next = parse(remote), current = parse(local);
      if (!next || !current) return !1;
      for (let i = 0; i < 3; i++) if (next.core[i] !== current.core[i]) return next.core[i] > current.core[i];
      if (!next.pre.length || !current.pre.length) return !next.pre.length && !!current.pre.length;
      for (let i = 0; i < Math.max(next.pre.length, current.pre.length); i++) {
        let a = next.pre[i], b = current.pre[i];
        if (a === b) continue;
        if (a === void 0 || b === void 0) return b === void 0;
        let an = /^\d+$/.test(a), bn = /^\d+$/.test(b);
        return an && bn ? Number(a) > Number(b) : an !== bn ? !an : a > b;
      }
      return !1;
    }
    function updateBell(t, latest, current) {
      if (!isNewerVersion(latest, current)) return null;
      let label = t("versionNew", { version: latest });
      return h(
        "span",
        { key: "update-bell", className: "mov-update-bell", "data-field": "update-bell", role: "img", "aria-label": label, title: label },
        h("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": !0 }, [
          h("path", { key: "body", d: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" }),
          h("path", { key: "clapper", d: "M10 21h4M12 2V1" })
        ])
      );
    }
    async function fetchUpdateSource(url, ms = 12e3) {
      let controller = typeof AbortController == "function" ? new AbortController() : null, timer = controller ? window.setTimeout(() => controller.abort(), ms) : null;
      try {
        let response = await fetch(url, {
          headers: { accept: "application/json" },
          signal: controller ? controller.signal : void 0
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        let data = await response.json();
        return { json: async () => data };
      } finally {
        timer && window.clearTimeout(timer);
      }
    }
    async function fetchRecentVersions() {
      let urls = [
        `${GITEE.api}/releases?per_page=100`,
        `${GITHUB.api}/releases?per_page=100`
      ], results = await Promise.allSettled(urls.map(async (url) => {
        let body = await (await (fetchSource || fetchUpdateSource)(url, 6e3)).json();
        if (!Array.isArray(body)) throw new Error("invalid releases");
        return body.filter((r) => !r.draft && !r.prerelease).map((r) => String(r.tag_name || "").replace(/^v/, "")).filter((version) => /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version));
      })), versions = [...new Set(results.flatMap((r) => r.status === "fulfilled" ? r.value : []))].sort((a, b) => isNewerVersion(a, b) ? -1 : isNewerVersion(b, a) ? 1 : 0).slice(0, 3);
      if (!versions.length) throw new Error("no published stable releases available");
      return versions;
    }
    async function fetchLatestVersion() {
      return (await fetchRecentVersions())[0];
    }
    return { PLUGIN_VERSION, UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, fetchRecentVersions, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS, isNewerVersion, updateBell };
  }
  function createUpdateActions(context) {
    function readUpdateCache() {
      try {
        let raw = window.localStorage.getItem(context.UPDATE_CACHE_KEY), saved = raw ? JSON.parse(raw) : null;
        if (!saved || typeof saved != "object")
          return { latest: "", versions: [], at: 0, fresh: !1 };
        let at = Number(saved.at) || 0;
        return {
          latest: String(saved.latest || ""),
          versions: Array.isArray(saved.versions) ? saved.versions.filter((v) => /^\d+\.\d+\.\d+$/.test(v)).slice(0, 3) : [],
          at,
          fresh: !!at && Date.now() - at < context.UPDATE_MAX_AGE_MS
        };
      } catch {
        return { latest: "", versions: [], at: 0, fresh: !1 };
      }
    }
    function rememberUpdateCheck(latest, versions = []) {
      try {
        window.localStorage.setItem(context.UPDATE_CACHE_KEY, JSON.stringify({ at: Date.now(), latest, versions }));
      } catch {
      }
    }
    function forgetUpdateCheck() {
      try {
        window.localStorage.removeItem(context.UPDATE_CACHE_KEY);
      } catch {
      }
    }
    async function checkForUpdate(silent = !1) {
      if (!silent) {
        context.setUpdateDeferred?.("");
        try {
          window.localStorage.removeItem(`${context.UPDATE_CACHE_KEY}.deferred`);
        } catch {
        }
        context.setUpdateStatus("working"), context.setUpdateMessage("");
      }
      let request = context.updateRequest ? ++context.updateRequest.current : 0;
      try {
        let versions = context.fetchRecentVersions ? await context.fetchRecentVersions() : [await context.fetchLatestVersion()], latest = versions[0];
        return context.updateRequest && request !== context.updateRequest.current ? "" : (context.setUpdateConfirm?.(!1), context.setUpdateLatest(latest), context.setUpdateAt((/* @__PURE__ */ new Date()).toLocaleTimeString()), context.setUpdateStatus("ok"), rememberUpdateCheck(latest, versions), latest);
      } catch (error) {
        return context.updateRequest && request !== context.updateRequest.current || silent || (context.setUpdateStatus("failed"), context.setUpdateMessage(context.t("versionFailed", { message: error?.message || String(error) }))), "";
      }
    }
    async function runOnlineUpdate() {
      if (context.updateConfirm !== !0) return;
      if (context.setUpdateConfirm(!1), context.PLUGIN_VERSION && context.isNewerVersion?.(context.updateLatest, context.PLUGIN_VERSION) !== !0) {
        context.setUpdateStatus("ok"), context.setUpdateMessage(context.t("versionLatest"));
        return;
      }
      context.setUpdateStatus("installing"), context.setUpdateMessage("");
      let probe = context.manager ? context.manager() : { manager: null, tried: ["未注入"] }, pluginManager = probe.manager;
      if (!pluginManager || typeof pluginManager.installBundle != "function") {
        context.setUpdateStatus("failed"), context.setUpdateMessage(context.t("versionUpdateUnavailable", { detail: probe.tried.join("，") }));
        return;
      }
      try {
        if (typeof pluginManager.listBundles != "function") throw new Error("source-unavailable");
        let listed = await pluginManager.listBundles(), bundle = (Array.isArray(listed) ? listed : listed?.ok === !0 && Array.isArray(listed.value) ? listed.value : null)?.find((item) => item?.name === context.PLUGIN_PACKAGE && item.installed === !0), source = typeof bundle?.source == "string" ? bundle.source.trim() : "";
        if (source.startsWith(`${context.PLUGIN_PACKAGE}@`) && (source = source.slice(context.PLUGIN_PACKAGE.length + 1)), !source) throw new Error("source-unavailable");
        let linked = /^link:/i.test(source), local = /^(?:file:|[a-z]:[\\/]|[\\/]|~[\\/])/i.test(source);
        if (linked || local && !/\.(?:tgz|tar\.gz)(?:[?#].*)?$/i.test(source)) {
          context.setUpdateStatus("failed"), context.setUpdateMessage("当前为本地目录链接安装，已停止在线更新，未执行替换。目录链接切换为成品包存在文件被清空或仍加载旧目录的风险。请先备份并保留原目录，使用成品包迁移流程；若目录已空，先恢复完整package。不要重置 API密钥或直接卸载。");
          return;
        }
        if (bundle.error || bundle.meta?.error) throw new Error("metadata-unavailable");
      } catch {
        context.setUpdateStatus("failed"), context.setUpdateMessage("无法核实插件安装来源或元信息，已停止更新，未执行替换。请保留现有配置和安装目录，核对安装状态后再处理；不要重置 API密钥或先卸载。");
        return;
      }
      let requestId = `${context.PLUGIN_PACKAGE}-update-${Date.now()}`, install = async (spec) => {
        try {
          return await pluginManager.installBundle(spec, { enabled: !0, requestId });
        } catch (error) {
          return { ok: !1, error: { message: error?.message || String(error) } };
        }
      }, failureText = (result) => String(result?.error?.message ?? result?.value?.error?.diagnostic ?? result?.value?.error?.code ?? "unknown"), worthRetrying = (text) => /429|queue overflowed|timed out|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|unable to access|network|fetch/i.test(text), lockfileUnverifiable = (text) => /MISSING_TARBALL_INTEGRITY/i.test(text);
      if (!/^\d+\.\d+\.\d+$/.test(context.updateLatest || "") || context.availableVersions && !context.availableVersions.includes(context.updateLatest)) {
        context.setUpdateStatus("failed"), context.setUpdateMessage(context.t("versionCheckFirst"));
        return;
      }
      let candidates = [
        releaseDownloadUrl(context.updateLatest, "gitee"),
        releaseDownloadUrl(context.updateLatest, "github")
      ], specUnresolvable = (text) => /Could not resolve|No matching version|ERR_PNPM_NO_MATCHING_VERSION|ERR_PNPM_FETCH_40[34]|HTTP[ :]+40[34]|404 Not Found|403 Forbidden/i.test(text), trySpec = async (spec) => {
        for (let round = 1; round <= context.UPDATE_ATTEMPTS; round += 1) {
          let result = await install(spec);
          if (result?.ok === !0 && result.value?.error?.code === "already-installed")
            return { failure: failureText(result), next: !1 };
          if (result?.ok === !0 && result.value?.application !== "failed")
            return { outcome: result.value || {} };
          let text = failureText(result);
          if (lockfileUnverifiable(text)) {
            if (round < context.UPDATE_ATTEMPTS) {
              context.setUpdateMessage(context.t("versionUpdateRetry", { attempt: round + 1, total: context.UPDATE_ATTEMPTS })), await new Promise((resolve) => window.setTimeout(resolve, 5e3));
              continue;
            }
            return { failure: text, next: !1, lockfile: !0 };
          }
          let transient = worthRetrying(text);
          if (transient && round < context.UPDATE_ATTEMPTS) {
            context.setUpdateMessage(context.t("versionUpdateRetry", { attempt: round + 1, total: context.UPDATE_ATTEMPTS })), await new Promise((resolve) => window.setTimeout(resolve, round * 1200));
            continue;
          }
          return { failure: text, next: !transient && specUnresolvable(text) };
        }
        return { failure: "unknown" };
      }, outcome = null, failure = "";
      for (let spec of candidates) {
        let attempt = await trySpec(spec);
        if (attempt.outcome) {
          outcome = attempt.outcome;
          break;
        }
        if (failure = attempt.failure || failure, !attempt.next)
          break;
      }
      if (!outcome) {
        context.setUpdateStatus("failed"), context.setUpdateMessage([
          lockfileUnverifiable(failure) ? context.t("versionUpdateLockfile") : "",
          context.t("versionUpdateFailed", { message: failure }),
          worthRetrying(failure) || /429|queue overflowed/i.test(failure) ? context.t("versionUpdateRateLimited") : ""
        ].filter(Boolean).join(" "));
        return;
      }
      if (outcome.application === "cancelled") {
        context.setUpdateStatus("ok"), context.setUpdateMessage(context.t("versionUpdateCancelled"));
        return;
      }
      if (outcome.version && outcome.version !== context.updateLatest) {
        forgetUpdateCheck(), context.setUpdateStatus("failed"), context.setUpdateMessage(`下载包版本为 ${outcome.version}，与已确认的 ${context.updateLatest} 不一致。请重新检查最新版本；配置与任务保留。`);
        return;
      }
      forgetUpdateCheck();
      let version = outcome.version || context.updateLatest;
      context.setUpdateLatest(""), context.setUpdateStatus(outcome.application === "restart-required" ? "restart" : "applied"), context.setUpdateMessage(outcome.application === "restart-required" ? context.t("versionUpdateRestart", { version }) : context.t(outcome.application === "applied" ? "versionUpdateDone" : "versionUpdatePending", { version }));
    }
    function deferUpdate() {
      context.setUpdateConfirm(!1), context.setUpdateDeferred(context.updateLatest);
      try {
        window.localStorage.setItem(`${context.UPDATE_CACHE_KEY}.deferred`, context.updateLatest);
      } catch {
      }
    }
    return { deferUpdate, readUpdateCache, rememberUpdateCheck, forgetUpdateCheck, checkForUpdate, runOnlineUpdate };
  }
  function renderUpdateNotice({ h, t, available, latest, deferred, status, confirmed, onUpdate, onLater }) {
    return !available || deferred === latest || status === "installing" ? null : h("div", { key: "update-notice", className: "mov-notice", role: "status", "data-field": "update-notice" }, [
      h("strong", { key: "title" }, t("versionNew", { version: latest })),
      h("p", { key: "optional" }, t("versionOptional")),
      confirmed ? h("p", { key: "confirm" }, t("versionUpdateConfirmHint")) : null,
      h("div", { key: "actions", className: "mov-cmd-row" }, [
        h(
          "button",
          {
            key: "update",
            type: "button",
            className: "mov-btn mov-btn-sm mov-btn-primary",
            "data-action": confirmed ? "update-notice-confirm" : "update-notice-open",
            onClick: onUpdate
          },
          confirmed ? t("versionUpdateConfirm", { version: latest }) : t("versionUpdate")
        ),
        h("button", { key: "later", type: "button", className: "mov-btn mov-btn-sm", "data-action": "update-later", onClick: onLater }, t("versionLater"))
      ])
    ]);
  }
  function formatReleaseTime(value) {
    if (typeof value != "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return "";
    let date = new Date(value);
    return Number.isFinite(date.getTime()) ? new Date(date.getTime() + 480 * 60 * 1e3).toISOString().slice(0, 16).replace("T", " ") : "";
  }

  // src/businesses/video-generation/client/connection-check.ts
  function createConnectionCheckController({ setState, readSnapshot, fetcher = (...args) => fetch(...args) }) {
    let request = 0, controller = null;
    function dispose() {
      request++, controller?.abort(), controller = null;
    }
    function invalidate() {
      dispose(), setState({ status: "idle", checks: [] });
    }
    async function run(ready) {
      if (!ready || controller) return;
      let id = ++request, revision = readSnapshot()?.revision, abort = new AbortController();
      controller = abort, setState({ status: "working", checks: [] });
      let timeout = setTimeout(() => abort.abort(), 16e3);
      try {
        let response = await fetcher("/metaontic-video/check-connection", { method: "POST", headers: { "content-type": "application/json" }, body: "{}", signal: abort.signal }), result = await response.json();
        if (id !== request || readSnapshot()?.revision !== revision) return;
        if (!response.ok || !Array.isArray(result?.checks) || !result.checks.length) throw Error();
        setState({ status: "done", checks: result.checks });
      } catch {
        id === request && readSnapshot()?.revision === revision && setState({ status: "failed", checks: [] });
      } finally {
        clearTimeout(timeout), id === request && (controller = null);
      }
    }
    return { run, invalidate, dispose };
  }

  // src/businesses/video-generation/client/settings-actions.ts
  var HIDDEN_CONNECTION_MODES = [
    ...VOLCENGINE_MODE_AVAILABLE ? [] : ["volcengine"]
  ];
  function hiddenConnectionLabel(t, mode) {
    return t(mode === "volcengine" ? VOLCENGINE_MODE_AVAILABLE ? "volcengine" : "volcengineUnavailable" : mode);
  }
  function createSettingsActions(context) {
    async function save() {
      let { saveInFlight, connectionBusy, setSaveError, setStatus, form, draft, same, validateSettings, persistConnection, setDraft, flashStatus, settingsError } = context;
      if (!saveInFlight.current && !(connectionBusy.current && !connectionBusy.pending)) {
        saveInFlight.current = !0, setSaveError(""), setStatus("saving");
        try {
          connectionBusy.pending && await connectionBusy.pending.catch(() => {
          }), connectionBusy.current = !0;
          let latest = form.getSnapshot().value || {}, nextMode = draft.connectionMode ?? latest.connectionMode ?? "metaontic", changes = Object.entries(draft).filter(([key, next]) => !same(latest[key], next));
          validateSettings({ ...latest, ...draft }), await persistConnection(form, changes, nextMode), setDraft((current) => Object.fromEntries(Object.entries(current).filter(([key, next]) => !Object.prototype.hasOwnProperty.call(draft, key) || !same(draft[key], next)))), flashStatus("saved");
        } catch (error) {
          setSaveError(settingsError(error)), setStatus("failed");
        } finally {
          connectionBusy.current = !1, saveInFlight.current = !1;
        }
      }
    }
    async function reset() {
      let { connectionBusy, t, setSaveError, setStatus, PLUGIN_OWNED_KEYS, persistBatch, form, setDraft, setVisibleKey, flashStatus, settingsError } = context;
      if (!connectionBusy.current && context.confirm(t("resetConfirm"))) {
        connectionBusy.current = !0, setSaveError(""), setStatus("saving");
        try {
          let targets = new Set(PLUGIN_OWNED_KEYS);
          await persistBatch(form, [...targets].map((key) => ({ op: "unset", path: [key] }))), setDraft({}), setVisibleKey(""), flashStatus("reset");
        } catch (error) {
          setSaveError(t("resetFailed", { message: settingsError(error) })), setStatus("failed");
        } finally {
          connectionBusy.current = !1;
        }
      }
    }
    function control(field) {
      let { draft, value, h, SELECTS, inputStyle, t, snapshot, visibleKey, setVisibleKey, edit, optionLabel } = context, current = field.key === "textModel" && !String(draft[field.key] ?? value[field.key] ?? "").trim() ? (SELECTS.textModel || [])[0] : draft[field.key] !== void 0 ? draft[field.key] : value[field.key] ?? (["sidebarAssistantEnabled", "imageUseVideoKey", "usageStatsEnabled", "autoCreateCanvas"].includes(field.key) ? !0 : field.key === "canvasEnabled" ? !1 : field.key === "pollIntervalMs" ? 5e3 : field.key === "maxWaitMs" ? 6e5 : void 0), secondsField = field.key === "pollIntervalMs" || field.key === "maxWaitMs", displayed = secondsField && current !== void 0 && current !== "" ? Number(current) / 1e3 : current, id = `metaontic-video-${field.key}`;
      if (field.kind === "switch")
        return h("label", { key: "control", htmlFor: id, className: "mov-switch" }, h("input", {
          id,
          "data-field": field.key,
          type: "checkbox",
          role: "switch",
          checked: !!current,
          onChange: (event) => edit(field.key, event.target.checked)
        }), h("span", null, t(field.key)));
      if (field.kind === "select") {
        let options = SELECTS[field.key] || [], hiddenModel = field.key === "model" && /seedance-2(?:-5|\.5)/i.test(String(current || "")), hiddenMode = field.key === "connectionMode" && HIDDEN_CONNECTION_MODES.includes(String(current || "")), legacyMerge = field.key === "mergeMode" && current === "seamless", retiredImageModel = field.key === "imageModel" && !options.includes(String(current || "")), retiredTextModel = field.key === "textModel" && RETIRED_TEXT_MODELS.includes(String(current || "")), removedMode = field.key === "connectionMode" && !["metaontic", "volcengine"].includes(String(current || "")), list = !removedMode && current && !options.includes(current) && !hiddenModel && !hiddenMode && !legacyMerge && !retiredImageModel && !retiredTextModel ? [...options, current] : options;
        return h("select", {
          key: "control",
          id,
          "data-field": field.key,
          className: `mov-input${field.mono ? " mov-mono" : ""}`,
          style: inputStyle,
          value: removedMode ? "" : legacyMerge ? "copy" : retiredImageModel || retiredTextModel ? options[0] ?? "" : current ?? "",
          onChange: (event) => edit(field.key, event.target.value)
        }, [
          removedMode ? h("option", { key: "select-connection", value: "", disabled: !0 }, t("unknownConnection")) : null,
          hiddenModel ? h("option", { key: "hidden-current", value: current, hidden: !0 }, t("modelHiddenCurrent")) : null,
          // 下架期间直接标出不可用；恢复后这一支不会走到（该方式会回到候选里）。
          hiddenMode ? h("option", { key: "hidden-current", value: current, hidden: !0 }, hiddenConnectionLabel(t, String(current || ""))) : null,
          ...list.map((option) => h("option", { key: option, value: option }, optionLabel(t, field.key, option)))
        ]);
      }
      let canReveal = field.key === "metaonticApiKey" || field.key === "volcengineApiKey" || field.key === "imageApiKey" || field.key === "textApiKey", revealed = canReveal && visibleKey === field.key, input = h("input", {
        // 这个 input 会和右侧眼睛按钮一起放进数组，React 要求数组子节点带 key
        key: "input",
        id,
        "data-field": field.key,
        className: `mov-input${field.mono ? " mov-mono" : ""}`,
        style: inputStyle,
        type: field.kind === "number" ? "number" : field.secret && !revealed ? "password" : "text",
        value: displayed ?? "",
        min: secondsField ? 1 : void 0,
        step: secondsField ? 1e-3 : void 0,
        placeholder: field.secret && (snapshot.secrets?.[field.key] || value[field.key]) ? t("apiKeyConfigured") : "",
        onChange: (event) => edit(field.key, field.kind === "number" && event.target.value !== "" ? secondsField ? Math.round(Number(event.target.value) * 1e3) : Number(event.target.value) : event.target.value)
      });
      return canReveal ? h("div", { key: "control", className: "mov-key-control" }, [
        input,
        h("button", {
          key: "toggle",
          type: "button",
          className: "mov-key-eye",
          "aria-label": t(revealed ? "hideKey" : "showKey"),
          title: t(revealed ? "hideKey" : "showKey"),
          "data-action": `toggle-${field.key}`,
          "aria-controls": id,
          "aria-pressed": revealed,
          onClick: () => setVisibleKey(revealed ? "" : field.key)
        }, h("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": !0 }, [
          h("path", { key: "eye", d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" }),
          h("circle", { key: "pupil", cx: 12, cy: 12, r: 3 }),
          revealed ? h("path", { key: "slash", d: "M3 3l18 18" }) : null
        ])),
        context.renderKeyAction?.(field)
      ]) : input;
    }
    return { save, reset, control };
  }

  // package.json
  var package_default = {
    name: "dsh-metaontic-video",
    version: "4.0.11",
    description: "DeepSeek Harness AI 视频创作插件：新手通过对话完善创意、审核脚本并生成视频；长视频采用分段续拍与本地合并，按实际调用确认费用。",
    license: "SEE LICENSE IN LICENSE",
    type: "module",
    keywords: [
      "dsh-metaontic-video",
      "dsh",
      "deepseek-harness",
      "deepseek-harness-plugin",
      "ai-video-generation",
      "text-to-video",
      "image-to-video",
      "video-script",
      "video-continuation",
      "long-video",
      "AI视频生成",
      "视频创作助手",
      "分段续拍",
      "长视频生成",
      "metaontic-video",
      "dsh-plugin",
      "ai-video",
      "seedance",
      "seedance-2",
      "video-generation",
      "video-extension",
      "storyboard",
      "ffmpeg",
      "new-api",
      "video-director"
    ],
    repository: {
      type: "git",
      url: "git+https://github.com/wxsimon2022/metaontic-video.git"
    },
    homepage: "https://github.com/wxsimon2022/metaontic-video#readme",
    bugs: {
      url: "https://github.com/wxsimon2022/metaontic-video/issues"
    },
    exports: {
      ".": "./index.js",
      "./client": "./client.js",
      "./locale/*.json": "./locale/*.json",
      "./icon": "./icon.svg",
      "./package.json": "./package.json",
      "./presets/video-director": "./presets/video-director.js",
      "./presets/video-director/locale/*.json": "./locale/presets/video-director/*.json",
      "./presets/promo-video": "./presets/promo-video.js",
      "./presets/promo-video/locale/*.json": "./locale/presets/promo-video/*.json",
      "./presets/video-director/icon": "./presets/icons/video-director.svg",
      "./presets/promo-video/icon": "./presets/icons/promo-video.svg"
    },
    files: [
      "index.js",
      "client.js",
      "cordis.patch.yml",
      "skills",
      "locale/*.json",
      "icon.svg",
      "logo.svg",
      "README.en.md",
      "MetaOnticVideo使用说明书.md",
      "MetaOnticVideo使用说明书.pdf",
      "CHANGELOG.md",
      "LICENSE",
      "docs/guide/*.svg",
      "docs/guide/*.png",
      "THIRD_PARTY_NOTICES.md",
      "presets/*.js",
      "locale/presets/**/*.json",
      "presets/icons/*.svg",
      "plugin-detail.md"
    ],
    engines: {
      node: ">=20",
      dsh: ">=0.2.0"
    },
    publishConfig: {
      access: "public",
      registry: "https://registry.npmjs.org/"
    },
    dsh: {
      bundle: {
        patch: "./cordis.patch.yml"
      },
      client: {
        platform: "web",
        inject: [
          "@deepseek-ai/dsh-client-locale",
          "@deepseek-ai/dsh-client-ui-settings",
          "@deepseek-ai/dsh-client-ui-tool",
          "@deepseek-ai/dsh-client-ui-session",
          "@deepseek-ai/dsh-client-ui-plugin-manager",
          "@deepseek-ai/dsh-api-remotes"
        ]
      }
    },
    devDependencies: {
      "@types/node": "^20.19.43",
      esbuild: "^0.28.2",
      react: "^19.3.1",
      "react-dom": "^19.3.1",
      typescript: "^5.9.3",
      hyperframes: "0.8.223",
      "@deepseek-ai/schemastery": "~3.18.5"
    },
    scripts: {
      typecheck: "tsc -p tsconfig.json",
      "build:locale": "node scripts/build.mjs locale",
      "build:host": "node scripts/build.mjs host",
      "build:client": "node scripts/build.mjs client",
      build: "npm run typecheck && node scripts/build.mjs",
      preview: "node scripts/preview.mjs",
      release: "node scripts/release.mjs",
      "clean:releases": "node scripts/clean-releases.mjs",
      "pack:test": "node scripts/pack-test.mjs",
      "market:index": "node scripts/market-index.mjs",
      "npm:publish": "node scripts/publish-npm.mjs",
      "npm:token": "node scripts/npm-token.mjs"
    },
    dependencies: {},
    releaseNotes: {
      version: "4.0.11",
      prerelease: !1,
      publishedAt: "2026-11-21T00:10:28.830Z",
      items: [
        "新增：侧栏视频创作助手显示开关，默认开启。",
        "优化：设置分组与间距，统一滑动开关，画面与声音移入更多设置。"
      ]
    },
    readme: `<img src="https://video.mybfs.cn/promo/share-logo.png" width="160" alt="MetaOnticVideo" />

# dsh-metaontic-video · AI 视频创作插件

[English](https://github.com/wxsimon2022/metaontic-video/blob/master/README.en.md)

DeepSeek Harness（DSH）AI 视频生成插件 MetaOnticVideo：**新手快速上手，低成本制作长视频。**

## 能做什么

- **快速创作**：说出想法，助手整理脚本，确认后生成并预览视频。
- **分段制作长视频**：逐段生成与续拍，保留进度，最后在本机合并。

图片与视频按接入渠道用量计费，生成前需确认费用。

## 在线安装

在 Harness「插件 → 添加插件」中粘贴链接，Windows 与 macOS 使用同一个安装包。

Gitee：

\`\`\`text
https://gitee.com/hackloop/metaontic-video/releases/download/latest/metaontic-video.tgz
\`\`\`

GitHub 备用：

\`\`\`text
https://github.com/wxsimon2022/metaontic-video/releases/latest/download/metaontic-video.tgz
\`\`\`

## 开始使用

1. 打开插件设置，选择 **MetaOntic AI**，填写 API密钥并保存。
2. 在会话中选择 **视频创作助手**；宣传内容可选择 **宣传视频助手**。
3. 描述需求，审核脚本并确认费用，再逐段预览制作结果。

例如：“制作一条30秒竖屏720P的视频，表现清晨湖面的宁静。”

## 相关链接

[使用说明](https://ai.mybfs.cn) · [问题反馈](https://github.com/wxsimon2022/metaontic-video/issues) · [更新记录](https://github.com/wxsimon2022/metaontic-video/blob/master/CHANGELOG.md) · [开发文档](https://github.com/wxsimon2022/metaontic-video/blob/master/docs/engineering/development.md) · [许可](https://github.com/wxsimon2022/metaontic-video/blob/master/LICENSE)
`
  };

  // src/businesses/video-generation/client/settings.ts
  function createSettingsPage(deps) {
    let {
      useSnapshot,
      React,
      h,
      TOKENS,
      same,
      validateSettings,
      persistConnection,
      PLUGIN_OWNED_KEYS,
      persistBatch,
      PLUGIN_VERSION,
      UPDATE_CACHE_KEY: UPDATE_CACHE_KEY2,
      UPDATE_MAX_AGE_MS: UPDATE_MAX_AGE_MS2,
      fetchLatestVersion,
      SELECTS,
      inputStyle,
      optionLabel,
      FIELD_BY_KEY,
      SECTIONS,
      PLUGIN_PACKAGE: PLUGIN_PACKAGE2,
      UPDATE_SPEC: UPDATE_SPEC2,
      UPDATE_ATTEMPTS: UPDATE_ATTEMPTS2,
      isNewerVersion,
      updateBell,
      PAGE_CSS
    } = deps;
    function makePage({ form, t, manager }) {
      return function(props) {
        let snapshot = useSnapshot(form), value = snapshot.value || {}, [draft, setDraft] = React.useState({}), selectedMode = draft.connectionMode ?? value.connectionMode ?? "metaontic", directMode = selectedMode === "volcengine", [visibleKey, setVisibleKey] = React.useState("");
        React.useEffect(() => {
          setVisibleKey("");
        }, [selectedMode]);
        let [status, setStatus] = React.useState("idle"), [saveError, setSaveError] = React.useState(""), [connectionCheck, setConnectionCheck] = React.useState({ status: "idle", checks: [] }), checkController = React.useRef(null);
        checkController.current || (checkController.current = createConnectionCheckController({ setState: setConnectionCheck, readSnapshot: () => form.getSnapshot() })), React.useEffect(() => (checkController.current.invalidate(), () => checkController.current.dispose()), [snapshot.revision]);
        let statusTimer = React.useRef(null), connectionBusy = React.useRef(!1), saveInFlight = React.useRef(!1), [updateStatus, setUpdateStatus] = React.useState("idle"), [updateMessage, setUpdateMessage] = React.useState(""), [updateLatest, setUpdateLatest] = React.useState(""), updateRequest = React.useRef(0), releaseNotes = package_default.releaseNotes, [updateAt, setUpdateAt] = React.useState(""), [updateConfirm, setUpdateConfirm] = React.useState(!1), [updateDeferred, setUpdateDeferred] = React.useState(() => {
          try {
            return window.localStorage.getItem(`${UPDATE_CACHE_KEY2}.deferred`) || "";
          } catch {
            return "";
          }
        }), { readUpdateCache, checkForUpdate, runOnlineUpdate, deferUpdate } = createUpdateActions({
          get UPDATE_CACHE_KEY() {
            return UPDATE_CACHE_KEY2;
          },
          get PLUGIN_VERSION() {
            return PLUGIN_VERSION;
          },
          get isNewerVersion() {
            return isNewerVersion;
          },
          get updateRequest() {
            return updateRequest;
          },
          get UPDATE_MAX_AGE_MS() {
            return UPDATE_MAX_AGE_MS2;
          },
          get setUpdateStatus() {
            return setUpdateStatus;
          },
          get setUpdateMessage() {
            return setUpdateMessage;
          },
          get fetchLatestVersion() {
            return fetchLatestVersion;
          },
          get setUpdateLatest() {
            return setUpdateLatest;
          },
          get setUpdateAt() {
            return setUpdateAt;
          },
          get t() {
            return t;
          },
          get setUpdateConfirm() {
            return setUpdateConfirm;
          },
          get manager() {
            return manager;
          },
          get PLUGIN_PACKAGE() {
            return PLUGIN_PACKAGE2;
          },
          get updateLatest() {
            return updateLatest;
          },
          get updateConfirm() {
            return updateConfirm;
          },
          get setUpdateDeferred() {
            return setUpdateDeferred;
          },
          get UPDATE_SPEC() {
            return UPDATE_SPEC2;
          },
          get UPDATE_ATTEMPTS() {
            return UPDATE_ATTEMPTS2;
          }
        }), updateTried = React.useRef(!1);
        if (React.useEffect(() => {
          if (props?.view === "summary") {
            updateTried.current = !1;
            return;
          }
          if (updateTried.current) return;
          updateTried.current = !0, setUpdateLatest(""), setUpdateConfirm(!1), setUpdateAt(""), setUpdateStatus("idle"), setUpdateMessage("");
          try {
            setUpdateDeferred(window.localStorage.getItem(`${UPDATE_CACHE_KEY2}.deferred`) || "");
          } catch {
            setUpdateDeferred("");
          }
          let cached = readUpdateCache();
          cached.latest && (setUpdateLatest(cached.latest), cached.at && setUpdateAt(new Date(cached.at).toLocaleTimeString()), setUpdateStatus("ok")), checkForUpdate(!0).catch(() => {
          });
        }, [props?.view]), props && props.view === "summary") {
          let text = !!value.model || !!snapshot.secrets?.apiKey ? t("summary", { provider: t(selectedMode), model: value.model || "-" }) : t("summaryEmpty");
          return h("span", { style: { color: TOKENS.muted } }, text);
        }
        let pending = Object.entries(draft).filter(([key, next]) => !same(value[key], next)), edit = (key, next) => {
          checkController.current.invalidate(), clearStatusTimer(), setStatus((current) => current === "idle" ? current : "idle"), setDraft((current) => ({ ...current, [key]: next }));
        };
        function clearStatusTimer() {
          statusTimer.current && (window.clearTimeout(statusTimer.current), statusTimer.current = null);
        }
        function flashStatus(next, holdMs = 2500) {
          clearStatusTimer(), setStatus(next), statusTimer.current = window.setTimeout(() => {
            statusTimer.current = null, setStatus("idle");
          }, holdMs);
        }
        function settingsError(error) {
          let message = error?.message || String(error);
          return ["unknownConnection", "atomicUnsupported", "atomicRejected", "settingsUnavailable", "settingsConflict", "settingsTransport", "readOnly", "invalidWait", "invalidSeam"].includes(message) ? t(message) : message;
        }
        let { save, reset, control } = createSettingsActions({
          saveInFlight,
          connectionBusy,
          setSaveError,
          setStatus,
          form,
          draft,
          same,
          validateSettings,
          persistConnection,
          persistBatch,
          setDraft,
          flashStatus,
          settingsError,
          t,
          snapshot,
          PLUGIN_OWNED_KEYS,
          setVisibleKey,
          value,
          h,
          SELECTS,
          inputStyle,
          optionLabel,
          edit,
          visibleKey,
          renderKeyAction: (field) => showsSharedValidation(field) ? connectionButton() : null,
          confirm: (message) => window.confirm(message)
        }), hints = {
          sidebarAssistantEnabled: t("sidebarAssistantEnabledHint"),
          connectionMode: selectedMode === "metaontic" ? [t("connectionMetaonticHint"), " ", h("a", { key: "metaontic-register", href: RELAY.signupUrl, target: "_blank", rel: "noopener noreferrer", style: { textDecoration: "underline" } }, t("connectionMetaonticRegister"))] : t(directMode && !VOLCENGINE_MODE_AVAILABLE ? "connectionVolcengineUnavailable" : "connectionModeHint"),
          metaonticApiKey: t("metaonticKeyHint"),
          volcengineApiKey: t("volcengineKeyHint"),
          model: t("modelHint"),
          imageModel: t("imageModelHint"),
          textModel: t("textModelHint"),
          seamTrimSeconds: t("seamTrimSecondsHint"),
          canvasEnabled: t("canvasEnabledHint"),
          autoCreateCanvas: t("autoCreateCanvasHint"),
          maxWaitMs: t("waitSecondsHint")
        };
        function showsSharedValidation(field) {
          return !directMode && field.key === "metaonticApiKey" && (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? !0) !== !1;
        }
        function fieldCell(field) {
          let classes = ["mov-field"];
          return field.kind === "switch" && classes.push("mov-field-switch"), field.wide && classes.push("mov-field-wide"), h("div", { key: field.key, className: classes.join(" ") }, [
            field.kind === "switch" ? null : h("label", { key: "label", className: "mov-label", htmlFor: `metaontic-video-${field.key}` }, t(["metaonticApiKey", "volcengineApiKey"].includes(field.key) ? !directMode && (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? !0) !== !1 ? "sharedModelKey" : "videoModelKey" : field.key)),
            control(field),
            showsSharedValidation(field) ? connectionFeedback() : null,
            hints[field.key] ? h("span", { key: "hint", className: "mov-hint", style: { marginTop: 4 } }, hints[field.key]) : null
          ]);
        }
        let renderGrid = (section) => {
          if (section.key === "sectionModels") {
            let shared2 = (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? !0) !== !1, common = directMode ? [] : [fieldCell(FIELD_BY_KEY.imageUseVideoKey), ...shared2 ? [fieldCell(FIELD_BY_KEY.metaonticApiKey)] : []], videoFields = ["model", ...shared2 ? ["textModel"] : [], ...directMode || !shared2 ? [directMode ? "volcengineApiKey" : "metaonticApiKey"] : []], imageFields = ["imageModel", ...shared2 ? [] : ["imageApiKey"]], textFields = !directMode && !shared2 ? ["textModel", "textApiKey"] : [];
            return h("div", { key: section.key, className: "mov-model-settings" }, [
              ...common,
              h("div", { key: "models", className: `mov-model-grid${directMode ? " mov-model-grid-single" : ""}` }, [
                h("div", { key: "video", className: "mov-model-card", "data-group": "video-model" }, videoFields.map((key) => fieldCell(FIELD_BY_KEY[key]))),
                directMode ? null : h("div", { key: "image", className: "mov-model-card", "data-group": "image-model" }, imageFields.map((key) => fieldCell(FIELD_BY_KEY[key]))),
                textFields.length ? h("div", { key: "text", className: "mov-model-card", "data-group": "text-model" }, textFields.map((key) => fieldCell(FIELD_BY_KEY[key]))) : null
              ])
            ]);
          }
          if (section.key === "sectionVideo")
            return h("div", { key: section.key, className: "mov-av-grid" }, [
              h("div", { key: "picture", className: "mov-av-card" }, [
                fieldCell(FIELD_BY_KEY.ratio),
                h("span", { key: "hint", className: "mov-hint" }, t("ratioLayoutHint"))
              ]),
              h("div", { key: "audio", className: "mov-av-card mov-av-audio" }, [
                h("span", { key: "label", className: "mov-label" }, t("audioSettings")),
                control(FIELD_BY_KEY.generateAudio),
                h("span", { key: "hint", className: "mov-hint" }, t("audioLayoutHint"))
              ])
            ]);
          let shared = (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? !0) !== !1, videoKey = directMode ? "volcengineApiKey" : "metaonticApiKey", canvasOn = (draft.canvasEnabled ?? value.canvasEnabled ?? !1) === !0, fields = section.key === "sectionModels" ? directMode ? ["model", videoKey] : shared ? ["imageUseVideoKey", videoKey, "model", "imageModel"] : ["imageUseVideoKey", "model", videoKey, "imageModel", "imageApiKey"] : section.fields;
          return h(
            "div",
            { key: section.key, className: "mov-grid" },
            fields.filter((key) => (key !== "volcengineApiKey" || directMode) && (!["imageModel", "imageUseVideoKey", "imageApiKey"].includes(key) || !directMode) && (key !== "imageApiKey" || (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? !0) === !1) && (key !== "metaonticApiKey" || selectedMode === "metaontic") && (key !== "autoCreateCanvas" || canvasOn)).map((key) => fieldCell(FIELD_BY_KEY[key])).filter(Boolean)
          );
        };
        function connectionButton() {
          return h("button", {
            key: "verify",
            type: "button",
            className: "mov-btn mov-key-verify",
            "data-action": "check-connection",
            disabled: pending.length > 0 || status === "saving" || snapshot.status !== "ready" || connectionCheck.status === "working",
            onClick: () => checkController.current.run(!pending.length && status !== "saving" && form.getSnapshot()?.status === "ready")
          }, t(connectionCheck.status === "working" ? "connectionChecking" : "connectionCheckButton"));
        }
        function connectionFeedback() {
          return h(
            "div",
            { key: "connection-feedback", role: "status", "aria-live": "polite" },
            pending.length ? h("p", { className: "mov-hint" }, t("connectionCheckSaveFirst")) : null,
            connectionCheck.status === "failed" ? h("p", { style: { color: TOKENS.error } }, t("connectionCheckFailed")) : connectionCheck.checks.map((check) => h("p", { key: check.target, style: { margin: "4px 0", fontSize: 12, color: check.level === "error" ? TOKENS.error : check.level === "success" ? TOKENS.success : TOKENS.muted } }, `${t("connectionTarget_" + check.target)}：${t("connectionResult_" + check.code)}`))
          );
        }
        let settingsRows = () => [
          h("div", { key: "generation", className: "mov-section" }, [
            h("div", { key: "title", className: "mov-section-title" }, t("sectionGeneration")),
            ...SECTIONS.filter((section) => !["sectionInterface", "sectionVideo"].includes(section.key)).map((section) => h("div", { key: section.key, className: "mov-parameter-group" }, [
              h("div", { key: "heading", className: "mov-parameter-heading" }, t(section.key)),
              renderGrid(section)
            ]))
          ]),
          h("details", { key: "advanced", className: "mov-section mov-advanced" }, [
            h("summary", { key: "toggle", className: "mov-advanced-toggle" }, [
              h("span", { key: "title" }, t("sectionCombined")),
              h("span", { key: "hint", className: "mov-hint" }, t("sectionCombinedHint"))
            ]),
            h("div", { key: "body", className: "mov-advanced-body" }, [
              h("div", { key: "sectionVideo", className: "mov-advanced-group", "data-group": "sectionVideo" }, [
                h("div", { key: "title", className: "mov-parameter-heading" }, t("sectionVideo")),
                renderGrid(SECTIONS.find((section) => section.key === "sectionVideo"))
              ]),
              ...[
                { key: "advancedPicture", fields: ["watermark"] },
                { key: "advancedMerge", fields: ["mergeMode", "seamTrimSeconds"], hint: "segmentsRetained" },
                { key: "advancedWait", fields: ["pollIntervalMs", "maxWaitMs"] },
                { key: "advancedTools", fields: ["ffmpegBinary", "ffprobeBinary"], hint: "toolsHint" },
                { key: "advancedStats", fields: ["usageStatsEnabled"], hint: "usageStatsHint" }
              ].map((group) => h("div", { key: group.key, className: `mov-advanced-group${group.key === "advancedTools" ? " mov-advanced-tools" : ""}`, "data-group": group.key }, [
                h("div", { key: "title", className: "mov-parameter-heading" }, t(group.key)),
                renderGrid(group),
                group.hint ? h("p", { key: "hint", className: "mov-hint", style: { margin: 0 } }, t(group.hint)) : null
              ]))
            ])
          ]),
          h("div", { key: "interface", className: "mov-section mov-interface", "data-group": "interface" }, [
            h("div", { key: "title", className: "mov-section-title" }, t("sectionInterface")),
            renderGrid(SECTIONS.find((section) => section.key === "sectionInterface"))
          ])
        ], overrides = Object.keys(snapshot.user || {}), footerMessage = status === "saved" ? t("saved") : status === "reset" ? t("resetDone") : status === "failed" ? saveError || t("saveFailed") : pending.length ? t("dirty") : "", footer = pending.length || status !== "idle" ? h("div", { key: "footer", className: "mov-footer" }, [
          footerMessage ? h("span", {
            key: "status",
            style: {
              fontSize: 12,
              color: status === "failed" ? TOKENS.error : status === "saved" || status === "reset" ? TOKENS.success : TOKENS.muted
            }
          }, footerMessage) : null
        ]) : null, resetRow = overrides.length || pending.length ? h("div", { key: "reset-row", className: "mov-footer mov-reset-row" }, [
          h("span", { key: "hint", className: "mov-hint", style: { flex: "1 1 200px" } }, t("resetHint")),
          pending.length ? h("button", {
            key: "save",
            "data-action": "save",
            type: "button",
            className: "mov-btn mov-btn-primary",
            disabled: status === "saving" || snapshot.writable === !1,
            onClick: save
          }, t(status === "saving" ? "saving" : "save")) : null,
          h("button", {
            key: "reset",
            "data-action": "reset",
            type: "button",
            className: "mov-btn",
            disabled: status === "saving" || snapshot.writable === !1,
            onClick: reset
          }, t("reset"))
        ]) : null, updateAvailable = !!updateLatest && !!PLUGIN_VERSION && isNewerVersion(updateLatest, PLUGIN_VERSION), updateText = updateStatus === "working" ? t("versionChecking") : updateStatus === "failed" ? updateMessage : updateStatus === "installing" ? t("versionUpdating") : updateStatus === "restart" || updateStatus === "applied" ? updateMessage : updateStatus === "ok" ? updateAvailable ? t("versionNew", { version: updateLatest }) : t("versionLatest") : "", updateTone = updateStatus === "failed" ? TOKENS.error : updateStatus === "restart" || updateStatus === "applied" || updateAvailable ? TOKENS.success : TOKENS.muted, versionBox = h("div", {
          key: "version",
          "data-field": "version",
          className: "mov-card"
        }, [
          h("div", { key: "head", className: "mov-card-head" }, [
            h("span", { key: "title", className: "mov-card-title" }, t("versionTitle")),
            h("span", {
              key: "current",
              "data-field": "versionCurrent",
              className: "mov-hint mov-current-version"
            }, [
              h("span", { key: "label" }, PLUGIN_VERSION ? t("versionCurrent", { version: PLUGIN_VERSION }) : ""),
              updateBell(t, updateLatest, PLUGIN_VERSION)
            ]),
            h("a", { key: "history", className: "mov-hint", href: "${CHANGELOG_URL}", target: "_blank", rel: "noopener noreferrer" }, t("versionHistory")),
            h("button", {
              key: "check",
              "data-action": "update-check",
              type: "button",
              className: "mov-btn mov-btn-sm mov-trailing",
              disabled: updateStatus === "working" || updateStatus === "installing",
              onClick: () => {
                checkForUpdate(!1).catch(() => {
                });
              }
            }, t(updateStatus === "working" ? "versionChecking" : "versionCheck"))
          ]),
          releaseNotes?.items?.length ? h("div", { key: "release-notes", "data-field": "releaseNotes" }, [
            h("div", { key: "heading", style: { display: "flex", alignItems: "baseline", gap: 12 } }, [
              h("span", { key: "title", className: "mov-card-title" }, `${releaseNotes.version} · ${t("releaseNotesTitle")}`),
              formatReleaseTime(releaseNotes.publishedAt) ? h("span", { key: "published-at", "data-field": "releasePublishedAt", className: "mov-foot-note" }, t("releaseUpdatedAt", { time: formatReleaseTime(releaseNotes.publishedAt) })) : null
            ]),
            h(
              "ul",
              { key: "items", style: { margin: "8px 0 0", paddingLeft: 18, fontSize: 12, lineHeight: 1.7, color: TOKENS.muted } },
              releaseNotes.items.map((item, index) => h("li", { key: index }, item))
            )
          ]) : null,
          updateText ? h("span", {
            key: "state",
            "data-field": "versionState",
            className: "mov-hint",
            style: { color: updateTone }
          }, updateText) : null,
          updateAvailable ? h("div", { key: "command", className: "mov-cmd-row" }, [
            // 点一下转成「确认更新」，再点一下让宿主重装本插件
            h("button", {
              key: "online",
              "data-action": "update-online",
              type: "button",
              className: "mov-btn mov-btn-sm mov-btn-primary",
              disabled: updateStatus === "installing",
              onClick: () => {
                updateConfirm ? runOnlineUpdate().catch(() => {
                }) : setUpdateConfirm(!0);
              }
            }, updateStatus === "installing" ? t("versionUpdating") : updateConfirm ? t("versionUpdateConfirm", { version: updateLatest }) : t("versionUpdate"))
          ]) : null,
          updateAvailable && updateConfirm ? h("span", {
            key: "confirm-hint",
            "data-field": "updateConfirmHint",
            className: "mov-hint"
          }, t("versionUpdateConfirmHint")) : null,
          updateAvailable ? h("span", { key: "hint", className: "mov-hint" }, t("versionHint")) : null,
          updateStatus === "ok" && updateAt ? h("span", { key: "at", className: "mov-foot-note" }, t("versionCheckedAt", { time: updateAt })) : null
        ]), notice = null;
        snapshot.status === "loading" ? notice = t("loading") : snapshot.value === void 0 ? notice = t("unavailable") : snapshot.writable === !1 && (notice = t("readOnly"));
        let blobs = notice && !snapshot.value ? [] : [footer, versionBox, resetRow];
        return h("div", { className: "mov-page" }, [
          // hover / focus 这类效果内联样式写不出来，集中在这张样式表里（class 都带 mov- 前缀）。
          h("style", { key: "styles" }, PAGE_CSS),
          !notice || snapshot.value ? renderUpdateNotice({
            h,
            t,
            available: updateAvailable,
            latest: updateLatest,
            deferred: updateDeferred,
            status: updateStatus,
            confirmed: updateConfirm,
            onUpdate: () => {
              updateConfirm ? runOnlineUpdate().catch(() => {
              }) : setUpdateConfirm(!0);
            },
            onLater: deferUpdate
          }) : null,
          notice ? h("p", { key: "notice", className: "mov-notice" }, notice) : null,
          ...notice && !snapshot.value ? [] : settingsRows(),
          ...blobs
        ]);
      };
    }
    return { makePage };
  }

  // src/ui/updates/update-notice.ts
  var UPDATE_HINT_CSS = `
  .mov-rail-hint { position: relative; display: inline-flex; align-items: center; }
  /* 收起侧栏：红点落在图标右上角 */
  .mov-rail-dot {
    position: absolute; top: -1px; right: -1px; width: 8px; height: 8px; border-radius: 50%;
    background: var(--dsw-alias-state-error-primary, #e5533d);
    box-shadow: 0 0 0 2px var(--dsw-specific-sidebar-fill, transparent);
  }
  /* 展开侧栏：这一行有名字，组件里的圆点收起，改在名字最后一个字的右上角点一个角标；贴着字不压字，所以不描边 */
  button:has(.mov-rail-dot):has(> span:nth-child(2)) .mov-rail-dot { display: none; }
  button:has(.mov-rail-dot):has(> span:nth-child(2)) > span:nth-child(2)::after {
    content: ""; display: inline-block; width: 8px; height: 8px; margin-left: -1px; border-radius: 50%;
    background: var(--dsw-alias-state-error-primary, #e5533d);
    vertical-align: super;
  }
`;
  function ensureUpdateHintStyles(doc = typeof document > "u" ? null : document) {
    if (!doc || typeof doc.createElement != "function" || !doc.head) return !1;
    if (doc.head.querySelector("style[data-mov-update-hint]")) return !0;
    let style = doc.createElement("style");
    return style.setAttribute("data-mov-update-hint", ""), style.textContent = UPDATE_HINT_CSS, doc.head.append(style), !0;
  }
  function createUpdateHint({ version = "", isNewerVersion, fetchRecentVersions, cacheKey, maxAge, deferKey = `${cacheKey}.deferred` }) {
    let listeners = /* @__PURE__ */ new Set(), latest = "", versions = [], at = 0, deferred = readDeferred(), checking = null;
    function storage() {
      try {
        return window.localStorage;
      } catch {
        return null;
      }
    }
    function readDeferred() {
      try {
        return String(storage()?.getItem(deferKey) || "");
      } catch {
        return "";
      }
    }
    function readCache() {
      try {
        let saved = JSON.parse(String(storage()?.getItem(cacheKey) || "null"));
        return !saved || typeof saved != "object" ? { latest: "", versions: [], at: 0 } : {
          latest: String(saved.latest || ""),
          versions: Array.isArray(saved.versions) ? saved.versions.filter((item) => /^\d+\.\d+\.\d+$/.test(String(item))).slice(0, 3) : [],
          at: Number(saved.at) || 0
        };
      } catch {
        return { latest: "", versions: [], at: 0 };
      }
    }
    function writeCache() {
      try {
        storage()?.setItem(cacheKey, JSON.stringify({ at, latest, versions }));
      } catch {
      }
    }
    function newer(remote) {
      try {
        return isNewerVersion?.(remote, version) === !0;
      } catch {
        return !1;
      }
    }
    let pending = () => !!latest && latest !== deferred && newer(latest);
    function snapshot() {
      return { latest, versions: [...versions], at, deferred, version, checking: !!checking, pending: pending() };
    }
    function emit() {
      for (let listener of [...listeners])
        try {
          listener(snapshot());
        } catch {
        }
    }
    function subscribe(listener) {
      return listeners.add(listener), () => {
        listeners.delete(listener);
      };
    }
    function sync() {
      let cached = readCache(), nextDeferred = readDeferred(), changed = cached.latest !== latest || cached.at !== at || nextDeferred !== deferred;
      return latest = cached.latest, versions = cached.versions, at = cached.at, deferred = nextDeferred, changed && emit(), snapshot();
    }
    function refresh(force = !1) {
      return sync(), checking || (!force && at && Date.now() - at < maxAge ? Promise.resolve(snapshot()) : (checking = (async () => {
        try {
          let list = await fetchRecentVersions(), next = (Array.isArray(list) ? list : []).map(String).filter((item) => /^\d+\.\d+\.\d+$/.test(item)).slice(0, 3);
          next.length && (latest = next[0], versions = next, at = Date.now(), writeCache());
        } catch {
        } finally {
          checking = null, emit();
        }
        return snapshot();
      })(), emit(), checking));
    }
    function defer() {
      deferred = latest;
      try {
        storage()?.setItem(deferKey, latest);
      } catch {
      }
      return emit(), snapshot();
    }
    function forget() {
      latest = "", versions = [], at = 0, deferred = "";
      try {
        storage()?.removeItem(cacheKey), storage()?.removeItem(deferKey);
      } catch {
      }
      return emit(), snapshot();
    }
    return { snapshot, pending, subscribe, sync, refresh, defer, forget, readCache };
  }
  function createUpdateHintView({
    React,
    h,
    t,
    hint,
    version,
    isNewerVersion,
    manager,
    pluginPackage,
    updateSpec,
    updateAttempts,
    cacheKey,
    maxAge
  }) {
    function useUpdateHint() {
      let [value, setValue] = React.useState(() => hint.snapshot());
      return React.useEffect(() => hint.subscribe(() => setValue(hint.snapshot())), []), value;
    }
    function UpdateHintDot() {
      return useUpdateHint().pending ? h("span", { key: "dot", className: "mov-rail-dot", "aria-hidden": !0, title: t("sidebarUpdateBadge") }) : null;
    }
    function UpdateHintBanner() {
      let state = useUpdateHint(), [status, setStatus] = React.useState("idle"), [message, setMessage] = React.useState(""), [confirm, setConfirm] = React.useState(!1), { forgetUpdateCheck, runOnlineUpdate } = createUpdateActions({
        get UPDATE_CACHE_KEY() {
          return cacheKey;
        },
        get UPDATE_MAX_AGE_MS() {
          return maxAge;
        },
        get PLUGIN_VERSION() {
          return version;
        },
        get isNewerVersion() {
          return isNewerVersion;
        },
        get PLUGIN_PACKAGE() {
          return pluginPackage;
        },
        get UPDATE_SPEC() {
          return updateSpec;
        },
        get UPDATE_ATTEMPTS() {
          return updateAttempts;
        },
        get manager() {
          return manager;
        },
        get t() {
          return t;
        },
        get updateLatest() {
          return hint.snapshot().latest;
        },
        get updateConfirm() {
          return confirm === !0;
        },
        get forgetUpdateCheck() {
          return forgetUpdateCheck;
        },
        setUpdateConfirm(value) {
          setConfirm(value === !0);
        },
        setUpdateStatus(value) {
          setStatus(value);
        },
        setUpdateMessage(value) {
          setMessage(value);
        },
        setUpdateLatest() {
        },
        setUpdateAt() {
        },
        setUpdateDeferred() {
        }
      });
      if (React.useEffect(() => {
        hint.refresh(!1);
      }, []), !state.pending && status === "idle") return null;
      let line = status === "installing" ? t("versionUpdating") : message;
      return h("div", { key: "update-hint", className: "mov-panel-update", "data-field": "panel-update" }, [
        renderUpdateNotice({
          h,
          t,
          available: state.pending,
          latest: state.latest,
          deferred: state.deferred,
          status,
          confirmed: confirm,
          onLater: () => {
            setConfirm(!1), hint.defer();
          },
          onUpdate: () => {
            if (!confirm) {
              setConfirm(!0);
              return;
            }
            runOnlineUpdate().then(() => hint.sync());
          }
        }),
        line ? h("p", { key: "line", className: "mov-panel-update-line", "data-field": "panel-update-line" }, line) : null
      ]);
    }
    return { useUpdateHint, UpdateHintDot, UpdateHintBanner };
  }

  // src/businesses/video-generation/client/panel.ts
  function createSidebarPanel({ h, TOKENS, PAGE_CSS, t, PANEL_ID: PANEL_ID2, GUIDE_URL: GUIDE_URL2, LOGO_SVG }) {
    let LOGO_SRC = LOGO_SVG ? `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}` : "", PANEL_CSS = `
      .mov-panel { width: 100%; max-width: 880px; margin: 0 auto; padding: 30px 32px 44px; display: flex; flex-direction: column; gap: 18px; }
      /* 有更新时的顶部提示：沿用设置页的 .mov-notice，只补面板里的间距与左侧色条 */
      .mov-panel-update { display: flex; flex-direction: column; gap: 8px; padding: 13px 14px; border: 1px solid ${TOKENS.border}; border-left: 3px solid ${TOKENS.primaryFill}; border-radius: 12px; background: ${TOKENS.cardFill}; }
      .mov-panel-update .mov-notice strong { display: block; font-size: 13px; color: ${TOKENS.text}; }
      .mov-panel-update-line { margin: 0; font-size: 12px; line-height: 1.5; color: ${TOKENS.muted}; }
      /* 品牌头图：插件 logo + 标题/简介，给空荡的内容区一个视觉锚点 */
      .mov-panel-hero { display: flex; align-items: center; gap: 14px; }
      .mov-panel-mark { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; color: ${TOKENS.primaryFill}; }
      .mov-panel-logo { width: 100%; height: 100%; object-fit: contain; }
      /* 左侧栏那一行的 logo：按宿主给的尺寸原样铺开，不参与主题取色 */
      .mov-rail-logo { display: block; object-fit: contain; }
      .mov-panel-head { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .mov-panel-title { margin: 0; font-size: 19px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-panel-intro { margin: 0; font-size: 13px; line-height: 1.55; color: ${TOKENS.muted}; }
      /* 主按钮吃掉多余宽度，次要按钮与链接退到第二排 */
      .mov-panel-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
      .mov-panel-actions .mov-btn-primary { flex: 1 1 220px; width: auto; min-width: 160px; height: 38px; }
      .mov-panel-actions .mov-btn:not(.mov-btn-primary) { min-width: 132px; }
      .mov-panel-link { margin-left: auto; font-size: 12px; color: ${TOKENS.primaryFill}; text-decoration: none; border-bottom: 1px solid transparent; }
      .mov-panel-link:hover { border-bottom-color: currentColor; }
      /* 两块价值点卡片：图标 + 标题 + 一句说明，窄容器自动落成一列 */
      .mov-panel-highlights { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; }
      .mov-panel-highlight { display: flex; align-items: flex-start; gap: 12px; padding: 13px 14px; border: 1px solid ${TOKENS.border}; border-radius: 12px; background: ${TOKENS.cardFill}; }
      .mov-panel-highlight-icon { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; color: ${TOKENS.primaryFill}; background: ${TOKENS.controlFill}; }
      .mov-panel-highlight-body { min-width: 0; }
      .mov-panel-highlight-title { font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-panel-highlight-desc { margin: 4px 0 0; font-size: 12px; line-height: 1.55; color: ${TOKENS.muted}; }
      /* 流程演示：四步卡片横排，卡片之间用箭头连起来；窄容器落成一列 */
      .mov-panel-flow { display: flex; align-items: stretch; }
      .mov-panel-step { position: relative; overflow: hidden; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 7px; padding: 13px 14px 14px; border: 1px solid ${TOKENS.border}; border-radius: 12px; background: ${TOKENS.cardFill}; animation: mov-flow-card 9s ease-in-out infinite; }
      .mov-panel-step-head { display: flex; align-items: center; gap: 8px; }
      .mov-panel-step-badge { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; font-size: 11px; font-weight: 600; color: ${TOKENS.primaryFill}; background: ${TOKENS.controlFill}; animation: mov-flow-badge 9s ease-in-out infinite; }
      .mov-panel-step-title { min-width: 0; font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-panel-step-desc { margin: 0; font-size: 12px; line-height: 1.55; color: ${TOKENS.muted}; }
      /* 右上角的淡色水印图标，只做装饰 */
      .mov-panel-step-icon { position: absolute; top: 10px; right: 10px; color: ${TOKENS.primaryFill}; opacity: .14; pointer-events: none; }
      /* 卡片之间的箭头：横排时向右，窄容器里转成向下 */
      .mov-panel-conn { flex: 0 0 26px; align-self: center; height: 2px; border-radius: 1px; background: ${TOKENS.border}; position: relative; }
      .mov-panel-conn::after { content: ''; position: absolute; top: 50%; right: -1px; width: 5px; height: 5px; border-top: 2px solid ${TOKENS.border}; border-right: 2px solid ${TOKENS.border}; transform: translateY(-50%) rotate(45deg); }
      /* 四步依次点亮，形成一条走动的流程；延迟按步号错开 */
      @keyframes mov-flow-card { 0%, 16% { border-color: ${TOKENS.primaryFill}; } 28%, 100% { border-color: ${TOKENS.border}; } }
      @keyframes mov-flow-badge { 0%, 16% { color: #fff; background: ${TOKENS.primaryFill}; } 28%, 100% { color: ${TOKENS.primaryFill}; background: ${TOKENS.controlFill}; } }
      .mov-panel-step[data-step="1"], .mov-panel-step[data-step="1"] .mov-panel-step-badge { animation-delay: 2.25s; }
      .mov-panel-step[data-step="2"], .mov-panel-step[data-step="2"] .mov-panel-step-badge { animation-delay: 4.5s; }
      .mov-panel-step[data-step="3"], .mov-panel-step[data-step="3"] .mov-panel-step-badge { animation-delay: 6.75s; }
      .mov-panel { container-type: inline-size; }
      @container (max-width: 620px) {
        .mov-panel-flow { flex-direction: column; align-items: stretch; }
        /* 竖向排布时不能再按剩余空间拉伸，否则卡片会被压扁 */
        .mov-panel-step { flex: 0 0 auto; }
        .mov-panel-conn { flex: 0 0 18px; width: 2px; height: 18px; align-self: flex-start; margin-left: 24px; }
        .mov-panel-conn::after { top: auto; right: 50%; bottom: -1px; transform: translateX(50%) rotate(135deg); }
      }
      @container (max-width: 560px) {
        .mov-panel { padding: 22px 18px 34px; }
        .mov-panel-link { margin-left: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .mov-panel-step, .mov-panel-step-badge { animation: none; }
      }
    `;
    function PanelIcon({ size = 18 }) {
      let pixels = Number(size) || 18;
      return LOGO_SRC ? h("img", {
        className: "mov-rail-logo",
        src: LOGO_SRC,
        alt: "",
        width: pixels,
        height: pixels,
        "aria-hidden": !0
      }) : h("svg", {
        width: pixels,
        height: pixels,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.7,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": !0
      }, [
        h("rect", { key: "frame", x: 2.5, y: 4.5, width: 13.5, height: 15, rx: 2.5 }),
        h("path", { key: "lens", d: "M16 10.4 21.5 7.3v9.4L16 13.6z" })
      ]);
    }
    function flowIcon(name, size = 22) {
      let common = {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.6,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": !0
      };
      return name === "idea" ? h("svg", common, [
        h("path", { key: "bulb", d: "M12 3.5a5.5 5.5 0 0 0-3.2 9.9V16h6.4v-2.6A5.5 5.5 0 0 0 12 3.5Z" }),
        h("path", { key: "base", d: "M9.5 18.5h5M10.5 21h3" })
      ]) : name === "script" ? h("svg", common, [
        h("rect", { key: "frame", x: 3, y: 4.5, width: 18, height: 15, rx: 2.2 }),
        h("path", { key: "split", d: "M3 12h18M11 12v7.5" })
      ]) : name === "generate" ? h("svg", common, [
        h("rect", { key: "frame", x: 3, y: 5, width: 18, height: 14, rx: 2.2 }),
        h("path", { key: "play", d: "M10.4 9.4 15 12l-4.6 2.6z" })
      ]) : name === "easy" ? h("svg", common, [
        h("path", { key: "star", d: "M12 4.2l1.9 5.1 5.1 1.9-5.1 1.9L12 18.2l-1.9-5.1L5 11.2l5.1-1.9z" }),
        h("path", { key: "spark", d: "M19 4.2v3M17.5 5.7h3" })
      ]) : name === "cheap" ? h("svg", common, [
        h("path", { key: "tag", d: "M11.2 3.8H5.4A1.6 1.6 0 0 0 3.8 5.4v5.8l8.8 8.8a1.6 1.6 0 0 0 2.3 0l5.8-5.8a1.6 1.6 0 0 0 0-2.3z" }),
        h("circle", { key: "hole", cx: 7.6, cy: 7.6, r: 1.2 })
      ]) : h("svg", common, [
        h("path", { key: "down", d: "M12 3.5v10m0 0 3.6-3.6M12 13.5 8.4 9.9" }),
        h("path", { key: "tray", d: "M4.5 16.5v2.2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.2" })
      ]);
    }
    function highlight(key, icon, title, desc) {
      return h("div", { key, className: "mov-panel-highlight" }, [
        h("span", { key: "icon", className: "mov-panel-highlight-icon" }, flowIcon(icon, 20)),
        h("div", { key: "body", className: "mov-panel-highlight-body" }, [
          h("div", { key: "title", className: "mov-panel-highlight-title" }, title),
          h("p", { key: "desc", className: "mov-panel-highlight-desc" }, desc)
        ])
      ]);
    }
    function VideoPanel(props) {
      let flowChildren = [
        { icon: "idea", title: t("panelStep1Title"), desc: t("panelStep1Desc") },
        { icon: "script", title: t("panelStep2Title"), desc: t("panelStep2Desc") },
        { icon: "generate", title: t("panelStep3Title"), desc: t("panelStep3Desc") },
        { icon: "merge", title: t("panelStep4Title"), desc: t("panelStep4Desc") }
      ].flatMap((step, index) => {
        let card = h("div", {
          key: `step-${index}`,
          className: "mov-panel-step",
          "data-step": String(index)
        }, [
          h("div", { key: "head", className: "mov-panel-step-head" }, [
            h("span", { key: "badge", className: "mov-panel-step-badge" }, String(index + 1)),
            h("span", { key: "title", className: "mov-panel-step-title" }, step.title)
          ]),
          h("p", { key: "desc", className: "mov-panel-step-desc" }, step.desc),
          h("span", { key: "icon", className: "mov-panel-step-icon" }, flowIcon(step.icon))
        ]);
        return index === 0 ? [card] : [h("span", { key: `conn-${index}`, className: "mov-panel-conn", "aria-hidden": !0 }), card];
      });
      return h("div", { className: "mov-panel" }, [
        h("style", { key: "styles" }, PAGE_CSS + PANEL_CSS),
        // 有更新时面板最上面插一条提示：入口由 client.ts 用真实 React 渲染，面板本身不持有更新状态。
        props?.updateBanner?.() || null,
        h("header", { key: "hero", className: "mov-panel-hero" }, [
          h(
            "span",
            { key: "mark", className: "mov-panel-mark" },
            LOGO_SRC ? h("img", { key: "logo", className: "mov-panel-logo", src: LOGO_SRC, alt: "", "aria-hidden": !0 }) : PanelIcon({ size: 24 })
          ),
          h("div", { key: "head", className: "mov-panel-head" }, [
            h("h1", { key: "title", className: "mov-panel-title" }, t("panelTitle")),
            h("p", { key: "intro", className: "mov-panel-intro" }, t("panelIntro"))
          ])
        ]),
        h("section", { key: "highlights", className: "mov-section" }, [
          h("div", { key: "highlights-label", className: "mov-section-title" }, t("panelHighlights")),
          h("div", { key: "highlights-cards", className: "mov-panel-highlights" }, [
            highlight("easy", "easy", t("panelHighlight1Title"), t("panelHighlight1Desc")),
            highlight("cheap", "cheap", t("panelHighlight2Title"), t("panelHighlight2Desc"))
          ])
        ]),
        h("section", { key: "start", className: "mov-section" }, [
          h("div", { key: "start-label", className: "mov-section-title" }, t("panelStart")),
          h("div", { key: "start-actions", className: "mov-panel-actions" }, [
            h("button", {
              key: "new",
              type: "button",
              className: "mov-btn mov-btn-primary",
              onClick: () => props?.startSession?.()
            }, t("panelNew")),
            h("button", {
              key: "settings",
              type: "button",
              className: "mov-btn",
              disabled: typeof props?.openSettings != "function",
              onClick: () => props?.openSettings?.()
            }, t("panelSettings")),
            h("a", {
              key: "guide",
              className: "mov-panel-link",
              href: GUIDE_URL2,
              target: "_blank",
              rel: "noopener noreferrer"
            }, t("panelGuide"))
          ])
        ]),
        h("section", { key: "flow", className: "mov-section" }, [
          h("div", { key: "flow-label", className: "mov-section-title" }, t("panelFlow")),
          h("div", { key: "flow-steps", className: "mov-panel-flow" }, flowChildren)
        ])
      ]);
    }
    return { PANEL_ID: PANEL_ID2, PanelIcon, VideoPanel };
  }

  // src/businesses/film-production/profiles/profile.definition.ts
  var entry = (label, creative, screenwriter, storyboard, criterion) => ({ label, rules: { creative, screenwriter, storyboard, reviewer: criterion }, criterion });

  // src/businesses/film-production/profiles/genres/comedy.ts
  var comedy_default = entry("喜剧", "寻找人物欲望与情境反差，不强制反转。", "以铺垫、升级、行为笑点与回应推进。", "为笑点兑现和反应留时间，不靠密集切镜。", "笑点有铺垫且符合人物逻辑。");

  // src/businesses/film-production/profiles/genres/drama.ts
  var drama_default = entry("剧情", "建立目标、阻碍、选择与后果。", "事件因果推动人物或关系变化。", "呈现决定与后果，不用空镜代替行动。", "人物选择与可见后果成立。");

  // src/businesses/film-production/profiles/genres/documentary.ts
  var documentary_default = entry("纪录", "建立真实问题、观察对象与素材来源。", "使用真实材料、采访问题或明确标注的戏剧化重现，不编造受访者原话。", "区分拟拍摄方案、真实素材和重现镜头。", "陈述有来源，VERIFIED_FACT/USER_PROVIDED/UNVERIFIED/DRAMATIZATION 分离。");

  // src/businesses/film-production/profiles/genres/animation.ts
  var animation_default = entry("动画", "明确世界规则、角色辨识与目标受众。", "动作有视觉因果，遵守世界规则。", "动作路径清楚，角色比例与空间规则稳定。", "世界规则、角色和动作可读性一致。");

  // src/businesses/film-production/profiles/genres/romance.ts
  var romance_default = entry("爱情", "围绕具体关系变化与情感障碍提炼体验。", "用互动、试探、回应推进关系，不靠告白口号。", "通过距离、视线与回应呈现关系变化。", "情感变化有具体互动与回应支撑。");

  // src/businesses/film-production/profiles/genres/thriller.ts
  var thriller_default = entry("悬疑惊悚", "规划观众已知和未知信息及线索。", "悬念有因果铺垫与回收，不依赖无原因反转。", "控制视点与信息揭示，不能藏掉理解所需证据。", "线索公平、因果成立且关键悬念得到处理。");

  // src/businesses/film-production/profiles/formats/skit.ts
  var skit_default = entry("情景小品", "集中在单一情境与核心互动。", "减少支线，动作、对白和反应可在预算内完成。", "少量必要机位保持互动可读。", "单一情境完整，关键反应有时长。");

  // src/businesses/film-production/profiles/formats/short-film.ts
  var short_film_default = entry("短片", "构建适合时长的完整体验。", "每场有功能与状态变化。", "镜头覆盖关键事件并控制节奏。", "结构完整，场景推进有必要性。");

  // src/businesses/film-production/profiles/formats/micro-drama.ts
  var micro_drama_default = entry("微短剧", "设计单集核心事件与连续人物关系。", "记录关系变化和未解决线索，不重置角色。", "关键冲突与回应清楚，不能用快切掩盖因果。", "单集成立并与连续人物线一致。");

  // src/businesses/film-production/profiles/formats/series.ts
  var series_default = entry("连续作品", "建立全片主线、单集功能与跨集状态。", "维护伏笔、前情与人物状态，按章交付。", "分章场镜分层规划，复查跨章边界。", "单集进度和全片完成状态准确，线索可追踪。");

  // src/businesses/film-production/profiles/formats/interview.ts
  var interview_default = entry("访谈", "明确问题、对象与真实素材需求。", "提供采访问题；未取得的回答不得当成真实原话。", "安排采访、反应与相关证据画面，不虚构已拍素材。", "采访来源真实，拟问与已回答内容区分。");

  // src/businesses/film-production/profiles/formats/commercial.ts
  var commercial_default = entry("广告片", "围绕需求、可信利益与行动目标设计。", "只使用有依据的产品主张与演示。", "展示产品使用过程和证据，避免暗示未证实功效。", "产品主张有依据，使用与行动目标清楚。");

  // src/businesses/film-production/profiles/formats/vlog.ts
  var vlog_default = entry("生活记录", "寻找日常观察、细节与体验变化。", "保留自然行动和环境反馈，不强加戏剧冲突。", "观察性构图与自然节奏，避免无意义运镜。", "日常细节有观察价值，节奏自然。");

  // src/businesses/film-production/profiles/formats/music-video.ts
  var music_video_default = entry("音乐影像", "建立音乐与视觉母题的关联。", "用动作和意象递进，不强塞对白或剧情。", "按音乐段落规划节奏与视觉变化。", "声画关联和意象递进明确。");

  // src/businesses/film-production/profiles/purposes/entertainment.ts
  var entertainment_default = entry("娱乐", "明确观众的情绪收益。", "保持人物与事件吸引力，避免空洞刺激。", "保证看点可见且节奏可读。", "观众体验有事件或画面支撑。");

  // src/businesses/film-production/profiles/purposes/promotion.ts
  var promotion_default = entry("宣传", "提炼地域或品牌辨识与记忆点。", "用具体可核实细节代替口号。", "展示可辨识地点、人物和生活细节。", "辨识度与传播信息具体且可信。");

  // src/businesses/film-production/profiles/purposes/education.ts
  var education_default = entry("科普教育", "确定观众要理解的问题与边界。", "按问题、证据、解释推进，事实不确定处标待核实。", "用演示或对比解释信息，不只堆字幕。", "知识准确，解释清楚，有证据与适用边界。");

  // src/businesses/film-production/profiles/purposes/sales.ts
  var sales_default = entry("销售转化", "定义需求、证据与行动目标。", "不编造性能、数据、认证或承诺。", "让使用过程与利益证据可见。", "卖点可信，行动清楚，无夸大主张。");

  // src/businesses/film-production/profiles/styles/rural-documentary.ts
  var rural_documentary_default = entry("乡村观察", "从具体生活观察寻找细节，不刻板化农村。", "语言自然，地域事实需来源。", "自然光、现场声与可辨空间，不自动添加破败贫困。", "生活细节可信，地域事实与观察边界清楚。");

  // src/businesses/film-production/profiles/styles/minidv.ts
  var minidv_default = entry("千禧 MiniDV", "以生活片段与自然观察组织视觉母题。", "对白小声自然，动作与停顿有生活感。", "按需轻微手持、对焦搜索、低饱和原生色彩和颗粒，不掩盖关键动作。", "DV 表现克制，人物动作与关键信息保持清楚。");

  // src/businesses/film-production/profiles/styles/cinematic-realism.ts
  var cinematic_realism_default = entry("写实电影", "以具体事件承载表达。", "行为和对白自然，不用抽象形容词代替剧情。", "以光源、材质、空间和动作描述风格，不堆参数。", "视觉细节真实并服务叙事。");

  // src/businesses/film-production/profiles/styles/stylized-animation.ts
  var stylized_animation_default = entry("风格化动画", "明确统一的造型和世界规则。", "表演与动作符合设定。", "统一比例、材质、色彩和动作物理规则。", "造型风格与世界物理规则跨镜一致。");

  // src/businesses/film-production/profiles/legacy/drama.ts
  var drama_default2 = {
    id: "DRAMA",
    revision: "1",
    label: "剧情短片",
    strategy: "人物目标→阻碍→选择→可见后果",
    boundary: "允许克制的日常矛盾，不机械添加悲情或反转。",
    creative_fields: {
      character_goal: "人物此刻的具体目标",
      choice_and_consequence: "关键选择与后果"
    },
    script_fields: {
      causal_progression: "事件之间的因果推进",
      character_change: "人物或关系的变化"
    },
    review_criteria: [
      {
        id: "drama_1",
        description: "动机是否由行动体现"
      },
      {
        id: "drama_2",
        description: "选择和结果是否有因果依据"
      }
    ],
    role_rules: {
      screenwriter: "围绕人物选择写场景，配角有自身理由，不用机械误会制造阻碍。",
      storyboard: "让观众看清选择发生的瞬间与后果，反应镜头承担关系变化。"
    }
  };

  // src/businesses/film-production/profiles/legacy/comedy.ts
  var comedy_default2 = {
    id: "COMEDY",
    revision: "1",
    label: "情景喜剧",
    strategy: "预期→升级→反差→回收",
    boundary: "笑点来自人物与情境，不依赖刻板印象、夸张表情或音效。",
    creative_fields: {
      comic_premise: "观众预期与喜剧前提",
      payoff: "反差落点与回收"
    },
    script_fields: {
      setup_payoff: "铺垫与笑点的对应",
      reaction_budget: "笑点前后反应与停顿的时间安排"
    },
    review_criteria: [
      {
        id: "comedy_1",
        description: "笑点是否有可辨识的铺垫"
      },
      {
        id: "comedy_2",
        description: "反差是否由人物行为引发且有反应时间"
      }
    ],
    role_rules: {
      screenwriter: "先让预期成立再偏离，避免角色为笑话突然失去常识。",
      storyboard: "关键笑点信息不可被运镜遮住，给观众读懂反差和人物反应的时间。"
    }
  };

  // src/businesses/film-production/profiles/legacy/lifestyle.ts
  var lifestyle_default = {
    id: "LIFESTYLE",
    revision: "1",
    label: "生活Vlog／氛围片",
    strategy: "体验起点→细节发现→感受变化",
    boundary: "可以无冲突、无对白、无人像；生活质感与观察顺序成立即可，不强造戏剧。",
    creative_fields: {
      experience_line: "本片体验或观察主线",
      detail_discovery: "值得观看的具体细节发现"
    },
    script_fields: {
      observation_progression: "细节如何逐步被发现",
      sensory_rhythm: "生活动作、环境声及留白的节奏"
    },
    review_criteria: [
      {
        id: "lifestyle_1",
        description: "观察是否有推进而非重复风景"
      },
      {
        id: "lifestyle_2",
        description: "生活动作和声音是否可信且符合用户氛围"
      }
    ],
    role_rules: {
      screenwriter: "以生活动作和感官发现组织内容，允许留白，不虚构苦难或硬加反转。",
      storyboard: "构图让观众发现细节，空间光线与环境声音参与叙事，固定机位可以成立。"
    }
  };

  // src/businesses/film-production/profiles/legacy/documentary.ts
  var documentary_default2 = {
    id: "DOCUMENTARY",
    revision: "1",
    label: "纪录／知识片",
    strategy: "核心问题→证据与例子→解释→回应",
    boundary: "区分已核实事实、用户材料、待核实内容与戏剧化重现；不编造采访和真实经历。",
    creative_fields: {
      central_question: "要回应的具体问题",
      evidence_plan: "已有来源与待补证据计划"
    },
    script_fields: {
      evidence_sources: "论据与对应来源，缺失标待核实",
      fact_fiction_boundary: "事实、解释和重现的边界"
    },
    review_criteria: [
      {
        id: "documentary_1",
        description: "关键陈述是否有来源或明确待核实"
      },
      {
        id: "documentary_2",
        description: "事实与虚构重现是否清楚区分"
      }
    ],
    role_rules: {
      screenwriter: "用可核实材料支撑说明，不为制造冲突编造真实人物心理。",
      storyboard: "证据画面与解释对应，重现须明确标识，画面不能暗示未经证实的因果。"
    }
  };

  // src/businesses/film-production/profiles/legacy/commercial.ts
  var commercial_default2 = {
    id: "COMMERCIAL",
    revision: "1",
    label: "产品广告",
    strategy: "需求→使用过程→价值证据→行动",
    boundary: "产品外观、功效、数据与认证须有依据，不通过画面暗示未证实效果。",
    creative_fields: {
      user_need: "具体用户需求",
      supported_benefit: "有资料支持的产品利益"
    },
    script_fields: {
      claims_and_evidence: "卖点及对应依据，缺失标待核实",
      usage_and_action: "可观察使用过程与行动引导"
    },
    review_criteria: [
      {
        id: "commercial_1",
        description: "卖点是否由材料支持"
      },
      {
        id: "commercial_2",
        description: "使用过程是否清楚且产品身份准确"
      }
    ],
    role_rules: {
      screenwriter: "展示真实需求与使用过程，避免堆卖点及无依据前后效果。",
      storyboard: "关键产品细节和使用步骤清楚可见，品牌文字与Logo依赖授权素材及后期能力。"
    }
  };

  // src/businesses/film-production/profiles/legacy/promotional.ts
  var promotional_default = {
    id: "PROMOTIONAL",
    revision: "1",
    label: "品牌／地域宣传",
    strategy: "识别特征→具体生活→人物或观察对象→情绪落点",
    boundary: "地域和品牌特征具体可信，不用空泛赞美替代内容；不强制增加人物。",
    creative_fields: {
      recognizable_identity: "品牌或地域的可辨识特征",
      emotional_anchor: "情绪落点及其具体载体"
    },
    script_fields: {
      distinctive_details: "具有辨识度的生活或品牌细节",
      identity_progression: "细节如何共同呈现主题"
    },
    review_criteria: [
      {
        id: "promotional_1",
        description: "画面是否具有当地或品牌辨识度"
      },
      {
        id: "promotional_2",
        description: "情绪是否由具体细节而非口号支撑"
      }
    ],
    role_rules: {
      screenwriter: "把身份特征落在具体使用或生活细节，真实地点资料不足标待核实。",
      storyboard: "空间、人物或物件关系体现地域品牌特征，不用通用航拍和素材堆砌替代。"
    }
  };

  // src/businesses/film-production/profiles/index.ts
  var REGISTRY = Object.fromEntries([drama_default2, comedy_default2, lifestyle_default, documentary_default2, commercial_default2, promotional_default].map((p) => [p.id, p])), WORK_TYPES = Object.keys(REGISTRY);

  // icon.svg
  var icon_default = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="MetaOnticVideo"><defs>
<linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#36e8ee"/><stop offset=".5" stop-color="#1688ff"/><stop offset="1" stop-color="#1742e8"/></linearGradient>
<linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#341ad5"/><stop offset=".5" stop-color="#7635ff"/><stop offset="1" stop-color="#176bff"/></linearGradient>
<linearGradient id="c" x1="1" y1="0" x2="0" y2="1"><stop stop-color="#2ce7ef"/><stop offset=".5" stop-color="#087bff"/><stop offset="1" stop-color="#2026ba"/></linearGradient>
<linearGradient id="d" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#24e5ec"/><stop offset=".45" stop-color="#1168ff"/><stop offset="1" stop-color="#2539d7"/></linearGradient>
</defs>
<path d="M9 25Q9 11 21 13L43 29 32 43 20 33V79Q20 85 14 85Q9 85 9 79Z" fill="url(#b)"/>
<path d="M91 25Q91 11 79 13L43 39 57 53 80 35V78Q80 85 86 85Q91 85 91 79Z" fill="url(#c)"/>
<path d="M10 23Q14 9 27 17L75 49Q79 52 75 56L43 77Q37 81 33 74L19 39Q15 27 10 23ZM40 40Q38 39 38 42V65Q38 68 41 66L59 54Q62 52 59 50Z" fill="url(#a)" fill-rule="evenodd"/>
<path d="M75 49Q80 52 81 64L91 80Q89 88 82 84L62 70 43 77Q38 80 34 75Z" fill="url(#d)"/>
<path d="M40 40Q38 39 38 42V65Q38 68 41 66L59 54Q62 52 59 50Z" fill="none"/>
</svg>
`;

  // src/businesses/video-generation/client.ts
  function createVideoClient(require2) {
    let React = require2("react"), h = React.createElement, { TOKENS, inputStyle, PAGE_CSS } = createTheme(), { MediaPreview } = createMediaPreview({ React, h }), { videoExecutionSource: videoExecutionSource2, VideoTaskProgress, VideoProgressDock } = createVideoProgress({ React, h, TOKENS }), { ToolResultView } = createToolResultView({ h, MediaPreview, VideoTaskProgress }), { PLUGIN_OWNED_KEYS, SELECTS, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, NS, NAMESPACE } = createClientConfig(), { zh, en } = createDictionaries(), { useSnapshot, same, validateSettings, persistConnection, persistBatch } = createSettingsState({ React }), { PLUGIN_VERSION, UPDATE_CACHE_KEY: UPDATE_CACHE_KEY2, UPDATE_MAX_AGE_MS: UPDATE_MAX_AGE_MS2, fetchLatestVersion, fetchRecentVersions, PLUGIN_PACKAGE: PLUGIN_PACKAGE2, UPDATE_SPEC: UPDATE_SPEC2, UPDATE_ATTEMPTS: UPDATE_ATTEMPTS2, isNewerVersion, updateBell } = createUpdates({ h }), { makePage } = createSettingsPage({ useSnapshot, React, h, TOKENS, same, validateSettings, persistConnection, PLUGIN_OWNED_KEYS, persistBatch, PLUGIN_VERSION, UPDATE_CACHE_KEY: UPDATE_CACHE_KEY2, UPDATE_MAX_AGE_MS: UPDATE_MAX_AGE_MS2, fetchLatestVersion, SELECTS, inputStyle, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, PLUGIN_PACKAGE: PLUGIN_PACKAGE2, UPDATE_SPEC: UPDATE_SPEC2, UPDATE_ATTEMPTS: UPDATE_ATTEMPTS2, isNewerVersion, updateBell, PAGE_CSS });
    return {
      inject: ["slots", "locale", "configForms", "uiSession"],
      apply(ctx, { settings }) {
        ctx.effect(() => ctx.uiSession.provide({
          hooks: ["videoExecutions"],
          resolve: (binding) => ({ hooks: { videoExecutions: videoExecutionSource2(binding.eventSource) } })
        }), "metaontic-video: actual video execution");
        let t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), "metaontic-video: dictionaries");
        let SupportAction = createSupportAction({ React, t, PAGE_CSS });
        ctx.effect(() => ctx.slots.inject("plugins.detail.actions", () => ctx.slots.register({
          name: "plugins.detail.actions",
          id: "metaontic-video-support",
          locale: NS
        }, SupportAction)), "metaontic-video: support action"), ctx.effect(() => ctx.slots.inject("conversation.chat.node", () => registerAuthNotice(ctx, h, t)), "metaontic-video: friendly service authentication notice");
        let form = ctx.configForms.get(NAMESPACE);
        for (let tool of ["video_generate", "video_extend", "video_status", "video_prepare_image", "video_project", "video_estimate"])
          ctx.effect(
            () => ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({ name: "tool.call.toolview", key: tool, locale: NS }, ToolResultView)),
            `metaontic-video: ${tool} progress`
          );
        ctx.effect(() => ctx.slots.inject("conversation.input.dock", () => ctx.slots.register(
          { name: "conversation.input.dock", id: "metaontic-video-progress", order: -20 },
          VideoProgressDock
        )), "metaontic-video: visible video progress");
        let pluginManager = () => {
          let tried = [], shape = (value) => value === void 0 ? "undefined" : value === null ? "null" : typeof value;
          try {
            let direct = typeof ctx.get == "function" ? ctx.get("remote.pluginManager") : void 0;
            if (direct && typeof direct.installBundle == "function") return { manager: direct, tried };
            tried.push(`remote.pluginManager=${shape(direct)}`);
          } catch (error) {
            tried.push(`remote.pluginManager 抛错：${error && error.message ? error.message : String(error)}`);
          }
          try {
            let remote = typeof ctx.get == "function" ? ctx.get("remote") : void 0, nested = remote && remote.pluginManager;
            if (nested && typeof nested.installBundle == "function") return { manager: nested, tried };
            tried.push(`remote=${shape(remote)}`);
          } catch (error) {
            tried.push(`remote 抛错：${error && error.message ? error.message : String(error)}`);
          }
          return { manager: null, tried };
        }, Page = makePage({ form, t, manager: pluginManager });
        settings.register({ id: "video", namespace: PLUGIN_PACKAGE2, locale: NS, Page });
        let FlowCanvasPage = null, { PanelIcon, VideoPanel } = createSidebarPanel({ React, h, TOKENS, PAGE_CSS, t, PANEL_ID, GUIDE_URL, LOGO_SVG: icon_default });
        ensureUpdateHintStyles();
        let updateHint = createUpdateHint({ version: PLUGIN_VERSION, isNewerVersion, fetchRecentVersions, cacheKey: UPDATE_CACHE_KEY2, maxAge: UPDATE_MAX_AGE_MS2 }), { UpdateHintDot, UpdateHintBanner } = createUpdateHintView({
          React,
          h,
          t,
          hint: updateHint,
          version: PLUGIN_VERSION,
          isNewerVersion,
          manager: pluginManager,
          pluginPackage: PLUGIN_PACKAGE2,
          updateSpec: UPDATE_SPEC2,
          updateAttempts: UPDATE_ATTEMPTS2,
          cacheKey: UPDATE_CACHE_KEY2,
          maxAge: UPDATE_MAX_AGE_MS2
        }), railIcon = (props) => h(
          "span",
          { className: "mov-rail-hint" },
          [h(PanelIcon, props), h(UpdateHintDot, { key: "dot" })]
        );
        ctx.effect(() => followConfiguredEntries(form, "sidebarAssistantEnabled", [
          () => ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
            name: "sidebar.panellist",
            id: PANEL_ID,
            order: 30,
            locale: NS,
            // 左侧那一行显示的名字，比面板标题更完整，方便在图标列表里认出来；有更新只加红点，不改文字。
            label: () => t("panelSidebarLabel")
          }, railIcon)),
          () => ctx.slots.inject("main", () => ctx.slots.register({
            name: "main",
            key: PANEL_ID,
            locale: NS,
            // 面板要的两个动作都按需取服务：老宿主没有这些服务时按钮自然失效，不报错。
            inject: () => ({
              startSession: () => ctx.get("uiWorkspace")?.startSession(void 0, { agentPreset: "video-director" }),
              openSettings: () => ctx.get("pluginNavigation")?.openBundle(PLUGIN_PACKAGE2),
              manager: pluginManager,
              // 面板顶部的更新入口：与设置页同一套两步确认，点左侧栏的「有更新」进来就能更新。
              updateBanner: () => h(UpdateHintBanner, { key: "update-hint" })
            })
          }, VideoPanel))
        ]), "metaontic-video: sidebar entry and panel follow saved preference"), updateHint.refresh(!1);
        let canvasSwitchOn = () => {
          try {
            return FLOW_CANVAS_AVAILABLE && form?.getSnapshot?.()?.value?.canvasEnabled === !0;
          } catch {
            return !1;
          }
        }, canvasSlots = [
          () => ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
            name: "sidebar.panellist",
            id: CANVAS_PANEL_ID,
            order: 31,
            locale: NS,
            label: () => t("canvasPanelLabel")
            // 更新入口在视频创作面板顶部，画布这一行不加圆点：点了也看不到更新，会误导。
          }, PanelIcon)),
          () => ctx.slots.inject("main", () => ctx.slots.register({
            name: "main",
            key: CANVAS_PANEL_ID,
            locale: NS
          }, FlowCanvasPage))
        ];
        ctx.effect(() => {
          let active = !1, disposers = [], close = () => {
            for (let off of disposers) off();
            disposers = [], active = !1;
          }, sync = () => {
            let wanted = canvasSwitchOn();
            if (wanted !== active) {
              if (!wanted) {
                close();
                return;
              }
              disposers = canvasSlots.map((register) => register()).filter((off) => typeof off == "function"), active = !0;
            }
          };
          sync();
          let unsubscribe;
          try {
            unsubscribe = form?.subscribe?.(sync);
          } catch {
            unsubscribe = void 0;
          }
          return () => {
            typeof unsubscribe == "function" && unsubscribe(), close();
          };
        }, "metaontic-video: canvas entry follows the canvas switch");
      }
    };
  }

  // src/platform/migration/bundle-inventory.ts
  var BundleInventoryError = class extends Error {
    constructor(code) {
      super(`Bundle inventory ${code}`);
      this.code = code;
    }
    code;
  };
  function assertMigrationActive(options) {
    if (options.signal?.aborted) throw new BundleInventoryError("aborted");
  }
  function readBundleInventory(manager, options = {}) {
    return assertMigrationActive(options), new Promise((resolve, reject) => {
      let settled = !1, finish = (error, rows) => {
        settled || (settled = !0, clearTimeout(timer), options.signal?.removeEventListener("abort", abort), error ? reject(error) : resolve(rows));
      }, abort = () => finish(new BundleInventoryError("aborted")), timer = setTimeout(() => finish(new BundleInventoryError("timeout")), options.timeoutMs ?? 8e3);
      options.signal?.addEventListener("abort", abort, { once: !0 });
      let request;
      try {
        assertMigrationActive(options), request = manager.listBundles();
      } catch {
        finish(new BundleInventoryError(options.signal?.aborted ? "aborted" : "unavailable"));
        return;
      }
      Promise.resolve(request).then((result) => {
        let rows = Array.isArray(result) ? result : result?.ok === !0 ? result.value : null;
        Array.isArray(rows) ? finish(void 0, rows) : finish(new BundleInventoryError("unavailable"));
      }, () => finish(new BundleInventoryError(options.signal?.aborted ? "aborted" : "unavailable")));
    });
  }

  // src/platform/migration/bundle-identity.ts
  function hasLegacyBundleConflict(rows) {
    return rows.some((row) => row.name === PLUGIN_ID && row.installed === !0 && row.enabled === !0) && rows.some((row) => row.name === PLUGIN_PACKAGE && row.installed === !0 && row.enabled === !0);
  }
  async function disableLegacyBundle(manager, options = {}) {
    if (!hasLegacyBundleConflict(await readBundleInventory(manager, options))) return "ready";
    if (typeof manager.setBundleEnabled != "function") throw new Error("Bundle migration unavailable");
    assertMigrationActive(options);
    let answer = await manager.setBundleEnabled(PLUGIN_ID, !1);
    assertMigrationActive(options);
    let value = answer?.ok === !0 ? answer.value : answer;
    if (answer?.ok === !1 || value?.error || !value) throw new Error("Bundle migration rejected");
    if (value.application === "restart-required") return "restart-required";
    let rows = await readBundleInventory(manager, options);
    if (rows.some((row) => row.name === PLUGIN_ID && row.enabled === !0) || !rows.some((row) => row.name === PLUGIN_PACKAGE && row.enabled === !0)) throw new Error("Bundle migration not applied");
    return "ready";
  }
  function hasLegacyBundle(rows) {
    return rows.some((row) => row.name === PLUGIN_ID && row.installed === !0);
  }
  async function cleanupLegacyBundle(manager, options = {}) {
    let rows = await readBundleInventory(manager, options);
    if (!hasLegacyBundle(rows)) return "ready";
    let current = rows.find((row) => row.name === PLUGIN_PACKAGE), legacy = rows.find((row) => row.name === PLUGIN_ID);
    if (current?.installed !== !0 || current?.enabled !== !0 || legacy?.enabled !== !1) return "retained";
    if (legacy.removable === !1 || typeof manager.removeBundle != "function") return "manual";
    let answer;
    assertMigrationActive(options);
    try {
      answer = await manager.removeBundle(PLUGIN_ID);
    } catch {
      return "retained";
    }
    assertMigrationActive(options);
    let value = answer?.ok === !0 ? answer.value : answer;
    if (value?.error?.code === "stop-profile") return "stop-profile";
    if (value?.application === "restart-required") return "restart-required";
    if (answer?.ok === !1 || value?.error || !value) return "retained";
    let after = await readBundleInventory(manager, options);
    if (hasLegacyBundle(after)) return "retained";
    if (!after.some((row) => row.name === PLUGIN_PACKAGE && row.installed === !0 && row.enabled === !0)) throw new Error("Current bundle unavailable");
    return "ready";
  }

  // src/ui/installation/bundle-migration.ts
  function migrationManager(ctx) {
    for (let read of [() => ctx.get?.("remote.pluginManager"), () => ctx.get?.("remote")?.pluginManager, () => ctx.remote?.pluginManager])
      try {
        let manager = read();
        if (typeof manager?.listBundles == "function") return manager;
      } catch {
      }
    return null;
  }
  async function mountBundleAwareClient(ctx, React, mount) {
    let manager = migrationManager(ctx);
    if (!manager) return mount();
    let abort = new AbortController(), inventory = { signal: abort.signal }, checking = null, alive = !0, status = "checking", confirmed = !1, running = null, listeners = /* @__PURE__ */ new Set(), notify = () => {
      if (alive) for (let listener of listeners) listener();
    }, set = (next) => {
      alive && (status = next, notify());
    };
    ctx.effect(() => () => {
      alive = !1, abort.abort(), listeners.clear();
    }, "video: migration lifetime");
    let ns = "settings.metaonticVideoMigration";
    ctx.effect(() => ctx.locale.register(ns, {
      zh: {
        title: "旧版插件迁移",
        checking: "正在检查插件安装状态…",
        conflict: "旧版 metaontic-video 和新版 dsh-metaontic-video 同时启用。更新或重启不会自动移除旧包，请完成迁移。",
        retained: "新版已可使用，但旧包仍在已安装列表中。可清理旧包，避免再次误启用。",
        ready: "迁移完成：已移除旧包，保留新版。",
        action: "切换并清理旧版",
        cleanup: "清理旧版安装包",
        switchOnly: "仅停用旧版并切换",
        working: "正在处理，请勿重复操作…",
        consent: "我已结束所有视频任务，同意停用并卸载旧包 metaontic-video。",
        preserved: "配置、API密钥、历史任务和素材继续保留；仅处理旧安装包。",
        failed: "迁移未完成，请重新检查。不会自动删除配置或重装插件。",
        blocked: "无法核实安装状态，请重新检查；暂不清理旧包。",
        timeout: "安装状态查询超时，请点击重新检查。暂不执行停用或卸载，迟到的查询结果不会继续操作。",
        restart: "宿主要求重启以完成切换。请先保存工作，重启后回到此处检查并继续清理。",
        stop: "新版已可使用，旧包已停用；宿主要求先退出当前运行环境才能卸载。请在插件管理中完成旧包卸载，不要删除配置或任务目录。",
        manual: "新版已可使用；当前宿主不支持在这里卸载旧包，请到插件管理中卸载 metaontic-video。",
        cleanupFailed: "新版已可使用，旧包清理尚未完成。请重新检查后重试，勿再次启用旧版。",
        loadFailed: "插件界面加载失败，请在插件管理中核对启用状态。配置和任务未删除。",
        retry: "重新检查"
      },
      en: {
        title: "Legacy plugin migration",
        checking: "Checking installed plugins…",
        conflict: "metaontic-video and dsh-metaontic-video are both enabled. Updating or restarting does not remove the old package.",
        retained: "The new plugin is ready. Remove the disabled old package to avoid enabling it again.",
        ready: "Migration complete. The old package was removed; the new plugin is retained.",
        action: "Switch and remove old package",
        cleanup: "Remove old package",
        switchOnly: "Disable old plugin and switch only",
        working: "Working…",
        consent: "All video tasks have finished. I agree to disable and uninstall metaontic-video.",
        preserved: "Settings, API credentials, task history and assets are retained. Only the old installation package is removed.",
        failed: "Migration was not completed. Check again. Settings will not be deleted and no reinstall is attempted.",
        blocked: "Installation state could not be verified. Check again before cleanup.",
        timeout: "Installation check timed out. Check again; no disable or uninstall will follow a late response.",
        restart: "Harness requires a restart. Save your work, restart and return here to finish cleanup.",
        stop: "The new plugin is ready and the old plugin is disabled. Harness requires the running profile to stop before uninstalling. Finish removal in plugin management; keep settings and task directories.",
        manual: "The new plugin is ready. Use plugin management to uninstall metaontic-video; this Host cannot remove it here.",
        cleanupFailed: "The new plugin is ready, but cleanup is incomplete. Check and retry; do not enable the old package again.",
        loadFailed: "The plugin UI could not load. Check enabled plugins; settings and tasks are preserved.",
        retry: "Check again"
      }
    }), "video: migration messages");
    let t = ctx.locale.bind(ns), h = React.createElement, activated = !1, check = () => alive ? checking || running || (set("checking"), checking = (async () => {
      try {
        let rows = await readBundleInventory(manager, inventory);
        if (!alive) return;
        if (hasLegacyBundleConflict(rows)) {
          set("conflict");
          return;
        }
        return set(hasLegacyBundle(rows) ? "retained" : "ready"), activate();
      } catch (error) {
        alive && set(error instanceof BundleInventoryError && error.code === "timeout" ? "timeout" : "blocked");
      }
    })().finally(() => {
      checking = null;
    }), checking) : Promise.resolve(), start = (cleanup) => !alive || cleanup && !confirmed ? Promise.resolve() : running || (set("working"), running = (async () => {
      try {
        let result = await disableLegacyBundle(manager, inventory);
        if (!alive) return;
        if (result === "restart-required") {
          set("restart");
          return;
        }
        if (cleanup) {
          let outcome = await cleanupLegacyBundle(manager, inventory);
          if (!alive) return;
          set(outcome === "ready" ? "ready" : outcome === "stop-profile" ? "stop" : outcome === "restart-required" ? "restart" : outcome === "manual" ? "manual" : "cleanupFailed");
        } else {
          let rows = await readBundleInventory(manager, inventory);
          set(hasLegacyBundle(rows) ? "retained" : "ready");
        }
        return activate();
      } catch (error) {
        if (!alive) return;
        if (error instanceof BundleInventoryError && error.code === "timeout") {
          set("timeout");
          return;
        }
        try {
          let rows = await readBundleInventory(manager, inventory);
          if (!hasLegacyBundleConflict(rows))
            return set("cleanupFailed"), activate();
        } catch {
        }
        set("failed");
      }
    })().finally(() => {
      running = null;
    }), running);
    function Notice() {
      let state = React.useSyncExternalStore((listener) => (listeners.add(listener), () => listeners.delete(listener)), () => `${status}:${confirmed}`, () => `${status}:${confirmed}`).split(":")[0];
      if (state === "ready") return null;
      let cleanupAllowed = ["conflict", "retained", "failed", "cleanupFailed"].includes(state);
      return h(
        "section",
        { style: { padding: 20, maxWidth: 680 }, "data-metaontic-migration": state },
        h("h3", null, t("title")),
        h("p", { role: ["failed", "blocked", "timeout", "cleanupFailed"].includes(state) ? "alert" : "status" }, t(state)),
        h("p", null, t("preserved")),
        cleanupAllowed ? h("label", null, h("input", { type: "checkbox", checked: confirmed, "data-migration-consent": !0, onChange: (event) => {
          confirmed = event.target.checked === !0, notify();
        } }), t("consent")) : null,
        cleanupAllowed ? h("button", { type: "button", disabled: !confirmed, "data-migration-action": "cleanup", onClick: () => start(!0) }, t(state === "conflict" ? "action" : "cleanup")) : null,
        state === "conflict" || state === "failed" ? h("button", { type: "button", "data-migration-action": "switch", onClick: () => start(!1) }, t("switchOnly")) : null,
        state !== "working" && state !== "checking" ? h("button", { type: "button", "data-migration-action": "check", onClick: () => running || check() }, t("retry")) : null
      );
    }
    let registerPage = () => ctx.effect(() => ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({ name: "plugins.bundle.config", key: PLUGIN_PACKAGE, locale: ns }, Notice)), "video: migration settings"), off = registerPage();
    function activate() {
      if (!(!alive || activated)) {
        activated = !0, typeof off == "function" && off();
        try {
          return mount((Page) => (props) => h("div", null, h(Notice), h(Page, props)));
        } catch {
          activated = !1, off = registerPage(), set("loadFailed");
        }
      }
    }
    return check();
  }

  // src/client.ts
  window.__ModuleLoader__.load({
    id: PLUGIN_PACKAGE,
    factory: (require2) => {
      let runtime = createClientRuntime(require2, [{ id: "video", create: createVideoClient }]);
      return { ...runtime, apply: (ctx) => mountBundleAwareClient(ctx, require2("react"), (decorateSettings) => runtime.apply(ctx, { decorateSettings })) };
    }
  });
})();
