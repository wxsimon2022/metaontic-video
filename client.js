window.__ModuleLoader__.load({
  id: "metaontic-video",
  factory(require2) {
    const React = require2("react");
    const h = React.createElement;
    const NAMESPACE = "metaontic-video";
    const NS = "settings.metaonticVideo";
    const zh = {
      summaryEmpty: "\u672A\u914D\u7F6E\uFF1A\u5230\u63D2\u4EF6\u8BBE\u7F6E\u9875\u70B9\u300C\u6FC0\u6D3B\u300D\u9886\u4E00\u628A\u5BC6\u94A5\u3002",
      summary: "{provider} \xB7 {model} \xB7 \u6BCF\u6BB5 {duration}s",
      providerNewapi: "New API \u4E2D\u8F6C\u7AD9",
      apiKeyConfigured: "\u5DF2\u914D\u7F6E\uFF0C\u7559\u7A7A\u8868\u793A\u4FDD\u6301\u539F\u503C",
      model: "\u6A21\u578B",
      duration: "\u6BCF\u6BB5\u79D2\u6570",
      singleMaxSeconds: "\u76F4\u51FA\u4E0A\u9650\uFF08\u79D2\uFF09",
      mergeMode: "\u5408\u5E76\u65B9\u5F0F",
      mergeModeSeamless: "\u65E0\u7F1D\u62FC\u63A5\uFF08\u5BF9\u9F50\u63A5\u7F1D\uFF09",
      mergeModeCopy: "\u65E0\u635F\u62FC\u63A5",
      mergeModeReencode: "\u91CD\u7F16\u7801\u62FC\u63A5",
      outputDir: "\u8F93\u51FA\u76EE\u5F55",
      keepSegments: "\u4FDD\u7559\u5206\u6BB5",
      ffmpegBinary: "ffmpeg \u8DEF\u5F84",
      ffprobeBinary: "ffprobe \u8DEF\u5F84",
      ffmpegTitle: "\u957F\u89C6\u9891\u5408\u5E76\u9700\u8981 ffmpeg",
      ffmpegBody: "\u89C6\u9891\u8D85\u8FC7 15 \u79D2\u65F6\u4F1A\u62C6\u6210\u51E0\u6BB5\u5206\u522B\u751F\u6210\u3001\u518D\u5728\u672C\u673A\u5408\u5E76\u6210\u4E00\u6761\u2014\u2014\u5408\u5E76\u8FD9\u4E00\u6B65\u7528\u7684\u662F ffmpeg\u3002\u6CA1\u88C5\u4E5F\u80FD\u751F\u6210\uFF0C\u53EA\u662F\u53EA\u7ED9\u5206\u6BB5\u5217\u8868\u3001\u4E0D\u5408\u6210\u6574\u6761\u3002",
      ffmpegInstallFor: "\u6309\u4F60\u7684\u7CFB\u7EDF\u88C5\u4E00\u4E0B\uFF08\u70B9\u53F3\u8FB9\u6309\u94AE\u590D\u5236\u547D\u4EE4\uFF09\uFF1A",
      ffmpegCopy: "\u590D\u5236",
      ffmpegCopied: "\u5DF2\u590D\u5236",
      ffmpegMore: "\u5176\u4ED6\u7CFB\u7EDF",
      ffmpegLess: "\u6536\u8D77\u5176\u4ED6\u7CFB\u7EDF",
      ffmpegAfter: "\u4E0D\u60F3\u81EA\u5DF1\u6572\u547D\u4EE4\u7684\u8BDD\uFF0C\u76F4\u63A5\u5728\u5BF9\u8BDD\u91CC\u8BF4\u300C\u5E2E\u6211\u88C5 ffmpeg\u300D\u2014\u2014\u63D2\u4EF6\u4F1A\u6267\u884C\u5B89\u88C5\uFF08\u547D\u4EE4\u4F1A\u5148\u8BA9\u4F60\u786E\u8BA4\uFF09\uFF1B\u88C5\u597D\u540E\u91CD\u8DD1\u4E00\u6B21\u5C31\u4F1A\u81EA\u52A8\u5408\u5E76\uFF08\u4E0D\u7528\u91CD\u65B0\u751F\u6210\uFF09\u3002ffmpeg \u88C5\u5728\u975E\u9ED8\u8BA4\u4F4D\u7F6E\u7684\u8BDD\uFF0C\u628A\u7EDD\u5BF9\u8DEF\u5F84\u586B\u5230\u4E0A\u9762\u7684\u300Cffmpeg \u8DEF\u5F84\u300D\u4E5F\u4E00\u6837\u7BA1\u7528\u3002\u5B89\u88C5\u5305\u81EA\u5E26 ffprobe\uFF0C\u5206\u6BB5\u65F6\u957F\u63A2\u6D4B\u4F1A\u4E00\u8D77\u89E3\u51B3\u3002",
      ffmpegManual: "\u60F3\u81EA\u5DF1\u88C5\uFF1AmacOS \u7528 Homebrew\uFF0CWindows \u7528 winget\uFF0CLinux \u7528\u7CFB\u7EDF\u5305\u7BA1\u7406\u5668\uFF1B\u88C5\u5B8C\u786E\u8BA4\u547D\u4EE4\u884C\u91CC\u80FD\u8DD1 ffmpeg -version \u5C31\u884C\u3002",
      registerEmail: "\u90AE\u7BB1\uFF08\u8D26\u53F7\uFF09",
      registerTitle: "\u6CA1\u6709 API Key\uFF1F",
      registerHint: "\u7528\u90AE\u7BB1\u9886\uFF1A\u586B\u90AE\u7BB1 \u2192 \u70B9\u300C\u83B7\u53D6\u9A8C\u8BC1\u7801\u300D\u2192 \u628A\u90AE\u4EF6\u91CC\u7684\u6570\u5B57\u586B\u8FDB\u6765 \u2192 \u70B9\u300C\u6FC0\u6D3B\u300D\u3002\u90AE\u7BB1\u5C31\u662F\u4F60\u7684\u8D26\u53F7\uFF0C\u4E00\u4E2A\u90AE\u7BB1\u53EA\u53D1\u4E00\u628A Key\uFF1B\u6210\u529F\u540E\u670D\u52A1\u7AEF\u628A Key\u3001\u4E0A\u6E38\u5730\u5740\u4E0E\u6A21\u578B\u76F4\u63A5\u5199\u8FDB\u914D\u7F6E\uFF0C\u4E0D\u7528\u624B\u586B\uFF0C\u9ED8\u8BA4\u989D\u5EA6 \xA50.01\u3002",
      registerEmailPlaceholder: "\u4F60\u7684\u90AE\u7BB1\uFF0C\u4F8B\u5982 name@example.com",
      registerCode: "\u9A8C\u8BC1\u7801",
      registerCodePlaceholder: "\u90AE\u4EF6\u91CC\u7684\u6570\u5B57",
      registerCodeSend: "\u83B7\u53D6\u9A8C\u8BC1\u7801",
      registerCodeSending: "\u53D1\u9001\u4E2D\u2026",
      registerCodeCooldown: "{seconds} \u79D2\u540E\u91CD\u53D1",
      registerCodeSent: "\u9A8C\u8BC1\u7801\u5DF2\u53D1\u5230 {email}\uFF1A5 \u5206\u949F\u5185\u6709\u6548\uFF0C\u586B\u8FDB\u6765\u70B9\u53F3\u8FB9\u7684\u6309\u94AE\u5373\u53EF\u3002",
      registerEmailLocked: "\u9A8C\u8BC1\u7801\u521A\u53D1\u5230\u4E0A\u9762\u8FD9\u4E2A\u90AE\u7BB1\uFF1A\u7B49\u5012\u8BA1\u65F6\u7ED3\u675F\u624D\u80FD\u6539\u3002",
      registerNeedEmail: "\u5148\u586B\u90AE\u7BB1\uFF0C\u518D\u70B9\u300C\u83B7\u53D6\u9A8C\u8BC1\u7801\u300D\u3002",
      registerNeedCode: "\u5148\u586B\u90AE\u4EF6\u91CC\u6536\u5230\u7684\u9A8C\u8BC1\u7801\u3002",
      registerRestored: "\u5DF2\u627E\u56DE\u672C\u673A\u5BC6\u94A5\uFF1A\u8FD9\u53F0\u8BBE\u5907\u4E4B\u524D\u9886\u8FC7\u7684\u90A3\u628A\u5E2E\u4F60\u586B\u597D\u4E86\uFF0C\u70B9\u300C\u4FDD\u5B58\u300D\u5373\u53EF\u3002",
      quotaTitle: "\u989D\u5EA6\uFF08\u5F53\u524D\u8FD9\u628A Key\uFF09",
      quotaSummary: "\u5269\u4F59 {remain} \xB7 \u5DF2\u7528 {used} \xB7 \u603B\u91CF {total}",
      quotaUnlimited: "\u4E0D\u9650\u989D\u5EA6",
      quotaLoading: "\u8BFB\u53D6\u989D\u5EA6\u4E2D\u2026",
      quotaRefresh: "\u5237\u65B0\u989D\u5EA6",
      quotaNoKey: "\u8FD8\u6CA1\u6709\u5BC6\u94A5\uFF1A\u6CE8\u518C\u540E\u8FD9\u91CC\u4F1A\u663E\u793A\u5269\u4F59 / \u5DF2\u7528\u989D\u5EA6\u3002",
      quotaNotRegistered: "\u670D\u52A1\u7AEF\u6CA1\u6709\u8FD9\u53F0\u8BBE\u5907\u7684\u6CE8\u518C\u8BB0\u5F55\uFF08\u6362\u8FC7\u8BBE\u5907 / \u6E05\u8FC7\u6570\u636E\uFF09\uFF1A\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u5904\u7406\u540E\u91CD\u65B0\u9886\u53D6\u3002",
      quotaFailed: "\u8BFB\u53D6\u989D\u5EA6\u5931\u8D25\uFF1A{message}",
      quotaUpdatedAt: "\u66F4\u65B0\u4E8E {time}",
      usageTitle: "\u4F7F\u7528\u8BB0\u5F55\uFF08\u6700\u8FD1 {days} \u5929\uFF09",
      usageSummary: "{count} \u6761 \xB7 \u8D39\u7528\u5408\u8BA1 {amount}",
      usageColTime: "\u65F6\u95F4",
      usageColKind: "\u7C7B\u578B",
      usageColModel: "\u6A21\u578B",
      usageColCost: "\u8D39\u7528",
      usageColStatus: "\u7ED3\u679C",
      usageEmpty: "\u8FD8\u6CA1\u6709\u8BB0\u5F55\uFF1A\u751F\u6210\u6216\u7EED\u62CD\u8FC7\u89C6\u9891\u540E\uFF0C\u8FD9\u91CC\u4F1A\u6309\u65F6\u95F4\u5217\u51FA\u6700\u8FD1\u51E0\u6B21\u3002",
      usageLoading: "\u8BFB\u53D6\u4F7F\u7528\u8BB0\u5F55\u4E2D\u2026",
      usageRefresh: "\u5237\u65B0\u8BB0\u5F55",
      usageFailed: "\u8BFB\u53D6\u4F7F\u7528\u8BB0\u5F55\u5931\u8D25\uFF1A{message}",
      usageMore: "\u65F6\u95F4\u7A97\u5185\u8FD8\u6709\u66F4\u65E9\u7684\u8BB0\u5F55\uFF0C\u8FD9\u91CC\u53EA\u663E\u793A\u6700\u8FD1\u7684 {count} \u6761\u3002",
      usageKeyMissing: "\u8FD8\u6CA1\u6709\u5BC6\u94A5\uFF1A\u9886\u5230 Key \u4E4B\u540E\uFF0C\u8FD9\u91CC\u4F1A\u663E\u793A\u7528\u5B83\u51FA\u7247\u7684\u8BB0\u5F55\u3002",
      usageStatusOk: "\u6210\u529F",
      usageStatusFailed: "\u5931\u8D25",
      sectionGeneration: "\u751F\u6210\u53C2\u6570",
      sectionMerge: "\u5408\u5E76\u4E0E\u8F93\u51FA",
      sectionAdvanced: "\u9AD8\u7EA7",
      register: "\u6FC0\u6D3B",
      registerWorking: "\u6CE8\u518C\u4E2D\u2026",
      registerOk: "\u6CE8\u518C\u6210\u529F\uFF1A\u4E0A\u6E38 / Key / \u5730\u5740 / \u6A21\u578B\u90FD\u5199\u597D\u4E86\uFF0C\u5BBF\u4E3B\u91CD\u8F7D\u914D\u7F6E\u540E\u751F\u6548\u3002",
      registerPartial: "\u5DF2\u62FF\u5230\u5BC6\u94A5\uFF0C\u4F46\u6709\u5B57\u6BB5\u5BBF\u4E3B\u6CA1\u63A5\u53D7\uFF0C\u8BF7\u68C0\u67E5\u540E\u624B\u52A8\u4FDD\u5B58\u3002",
      registerFailed: "\u6CE8\u518C\u5931\u8D25\uFF1A{message}",
      registerDisabled: "\u6CE8\u518C\u670D\u52A1\u4E0D\u53EF\u7528\uFF1A{message}",
      registerNoKey: "\u6CE8\u518C\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u5BC6\u94A5\uFF08\u540E\u7AEF\u4E2D\u8F6C\u7AD9\u914D\u7F6E\u53EF\u80FD\u6709\u95EE\u9898\uFF09\u3002",
      mode: "\u7EED\u62CD\u65B9\u5F0F",
      modeContinuous: "\u540C\u673A\u4F4D\u8FDE\u7EED",
      modeCloseup: "\u5207\u8FD1\u666F",
      resolution: "\u5206\u8FA8\u7387",
      ratio: "\u753B\u9762\u6BD4\u4F8B",
      generateAudio: "\u751F\u6210\u97F3\u9891",
      watermark: "\u52A0\u6C34\u5370",
      extraParams: "\u989D\u5916\u53C2\u6570\uFF08JSON\uFF09",
      pollIntervalMs: "\u8F6E\u8BE2\u95F4\u9694\uFF08\u6BEB\u79D2\uFF09",
      maxWaitMs: "\u5355\u6B21\u6700\u957F\u7B49\u5F85\uFF08\u6BEB\u79D2\uFF09",
      save: "\u4FDD\u5B58",
      reset: "\u6062\u590D\u9ED8\u8BA4",
      saving: "\u4FDD\u5B58\u4E2D\u2026",
      saved: "\u5DF2\u4FDD\u5B58\uFF0C\u5BBF\u4E3B\u91CD\u8F7D\u914D\u7F6E\u540E\u751F\u6548\u3002",
      saveFailed: "\u5BBF\u4E3B\u62D2\u7EDD\u4E86\u8FD9\u6B21\u5199\u5165\uFF0C\u8BF7\u68C0\u67E5\u5B57\u6BB5\u53D6\u503C\u3002",
      dirty: "\u6709\u672A\u4FDD\u5B58\u7684\u6539\u52A8",
      clean: "\u6CA1\u6709\u6539\u52A8",
      loading: "\u8BFB\u53D6\u914D\u7F6E\u4E2D\u2026",
      unavailable: "\u5BBF\u4E3B\u8FD8\u6CA1\u6709\u628A\u672C\u6761\u76EE\u5F53\u4F5C\u53EF\u7F16\u8F91\u8BBE\u7F6E\u9879\u63D0\u4F9B\u670D\u52A1\uFF08\u914D\u7F6E\u547D\u540D\u7A7A\u95F4 metaontic-video \u672A\u5C31\u7EEA\uFF09\u3002\u82E5 profile \u7684 cordis.patch.yml \u91CC\u5DF2\u6709\u8BE5\u6761\u76EE\uFF0C\u8BF7\u91CD\u542F Harness \u8BA9\u5BBF\u4E3B\u91CD\u65B0\u52A0\u8F7D\uFF1B\u91CD\u542F\u540E\u4ECD\u662F\u8FD9\u53E5\u8BDD\uFF0C\u5C31\u662F\u5BBF\u4E3B\u7248\u672C\u4E0E\u63D2\u4EF6\u7684\u8BBE\u7F6E\u63A5\u53E3\u4E0D\u5339\u914D\u3002",
      readOnly: "\u5F53\u524D profile \u4E0D\u63A5\u53D7\u8868\u5355\u5199\u5165\u3002"
    };
    const en = {
      summaryEmpty: 'Not configured: open the plugin settings and click "Register & fill in".',
      summary: "{provider} \xB7 {model} \xB7 {duration}s per segment",
      providerNewapi: "New API relay",
      apiKeyConfigured: "Configured; leave empty to keep it",
      model: "Model",
      duration: "Seconds per segment",
      singleMaxSeconds: "Direct generation limit (s)",
      mergeMode: "Merge mode",
      mergeModeSeamless: "Seamless (match junctions)",
      mergeModeCopy: "Stream copy",
      mergeModeReencode: "Re-encode",
      outputDir: "Output directory",
      keepSegments: "Keep segments",
      ffmpegBinary: "ffmpeg path",
      ffprobeBinary: "ffprobe path",
      ffmpegTitle: "Merging long videos needs ffmpeg",
      ffmpegBody: "Videos longer than 15 seconds are generated as several shots and merged into one file on this machine \u2014 that merge needs ffmpeg. Without it you still get the video, just as separate segments instead of one file.",
      ffmpegInstallFor: "Install it for your OS (click the button to copy the command):",
      ffmpegCopy: "Copy",
      ffmpegCopied: "Copied",
      ffmpegMore: "Other systems",
      ffmpegLess: "Hide other systems",
      ffmpegAfter: 'Rather not touch a terminal? Just say "\u5E2E\u6211\u88C5 ffmpeg" in the chat and the plugin runs the install for you (it asks you to confirm the command first). Re-run the generation afterwards and the merge happens automatically \u2014 no need to regenerate. Installed somewhere unusual? Put the absolute path in the "ffmpeg path" field above. The package ships ffprobe too, so segment probing is fixed at the same time.',
      ffmpegManual: "Installing by hand: Homebrew on macOS, winget on Windows, your distro package manager on Linux \u2014 you are set once `ffmpeg -version` works in a terminal.",
      registerEmail: "Email (this is your account)",
      registerTitle: "No API key yet?",
      registerHint: 'Register with your email: type it, click "Send code", then paste the number from the mail and click "Register & fill in". One email gets one key. Provider, key, base URL and model are filled in for you. Default quota \xA50.01.',
      registerEmailPlaceholder: "you@example.com",
      registerCode: "Verification code",
      registerCodePlaceholder: "code from the mail",
      registerCodeSend: "Send code",
      registerCodeSending: "Sending\u2026",
      registerCodeCooldown: "Resend in {seconds}s",
      registerCodeSent: "Code sent to {email} \u2014 valid for 5 minutes.",
      registerEmailLocked: "Code just went to this address \u2014 edit it after the countdown.",
      registerNeedEmail: "Type your email before requesting a code.",
      registerNeedCode: "Type the code from the email first.",
      registerRestored: "Restored the key issued to this device; click Save to apply.",
      quotaTitle: "Quota (current key)",
      quotaSummary: "Remaining {remain} \xB7 used {used} \xB7 total {total}",
      quotaUnlimited: "Unlimited",
      quotaLoading: "Reading quota\u2026",
      quotaRefresh: "Refresh quota",
      quotaNoKey: "No key yet \u2014 remaining / used quota shows here after registration.",
      quotaNotRegistered: "The service has no registration for this device (new device or cleared data) \u2014 ask an admin to reset it.",
      quotaFailed: "Failed to read quota: {message}",
      quotaUpdatedAt: "updated {time}",
      register: "Register & fill in",
      registerWorking: "Registering\u2026",
      registerOk: "Registered: provider, key, base URL and model written; applies after the config reload.",
      registerPartial: "Key received, but some fields were rejected; please review and save manually.",
      registerFailed: "Registration failed: {message}",
      registerDisabled: "Register service unavailable: {message}",
      registerNoKey: "The register service returned no key (check the relay configuration).",
      sectionGeneration: "Generation",
      sectionMerge: "Merge & output",
      sectionAdvanced: "Advanced",
      mode: "Continuation",
      modeContinuous: "Same camera",
      modeCloseup: "Cut to close-up",
      resolution: "Resolution",
      ratio: "Aspect ratio",
      generateAudio: "Generate audio",
      watermark: "Watermark",
      extraParams: "Extra params (JSON)",
      pollIntervalMs: "Poll interval (ms)",
      maxWaitMs: "Max wait (ms)",
      save: "Save",
      reset: "Reset to defaults",
      saving: "Saving\u2026",
      saved: "Saved; the Host applies it after the config reload.",
      saveFailed: "The Host rejected this write; check the field values.",
      dirty: "Unsaved changes",
      clean: "No changes",
      loading: "Reading configuration\u2026",
      unavailable: "This Host does not serve this entry as an editable setting yet (namespace metaontic-video is not ready). If the row already exists in the profile cordis.patch.yml, restart Harness so the Host reloads it; if the message persists, the Host version and the plugin settings interface do not match.",
      readOnly: "This profile does not accept form writes."
    };
    const SELECTS = {
      mode: ["continuous", "closeup"],
      resolution: ["480p", "720p", "1080p"],
      ratio: ["16:9", "9:16", "4:3", "3:4", "1:1", "adaptive"],
      mergeMode: ["seamless", "copy", "reencode"]
    };
    const SECTIONS = [
      { key: "sectionGeneration", fields: ["model", "duration", "singleMaxSeconds", "mode", "resolution", "ratio", "generateAudio", "watermark"] },
      { key: "sectionMerge", fields: ["mergeMode", "outputDir", "keepSegments"] },
      { key: "sectionAdvanced", fields: ["extraParams", "pollIntervalMs", "maxWaitMs", "ffmpegBinary", "ffprobeBinary"] }
    ];
    const FIELDS = [
      { key: "model", kind: "text" },
      { key: "duration", kind: "number" },
      { key: "singleMaxSeconds", kind: "number" },
      { key: "mode", kind: "select" },
      { key: "resolution", kind: "select" },
      { key: "ratio", kind: "select" },
      { key: "generateAudio", kind: "switch" },
      { key: "watermark", kind: "switch" },
      { key: "mergeMode", kind: "select" },
      { key: "outputDir", kind: "text" },
      { key: "keepSegments", kind: "switch" },
      { key: "extraParams", kind: "text" },
      { key: "pollIntervalMs", kind: "number" },
      { key: "maxWaitMs", kind: "number" },
      { key: "ffmpegBinary", kind: "text" },
      { key: "ffprobeBinary", kind: "text" }
    ];
    const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((field) => [field.key, field]));
    const DEFAULT_REGISTER_API = "https://video.mybfs.cn";
    const DEFAULT_REGISTER_TOKEN = "metaontic-video-register-v1";
    function currentOs() {
      const nav = window.navigator || {};
      const raw = String(
        nav.userAgentData?.platform || nav.platform || nav.userAgent || ""
      ).toLowerCase();
      if (/mac|darwin|iphone|ipad/.test(raw)) return "macos";
      if (/win/.test(raw)) return "windows";
      return "linux";
    }
    const FFMPEG_INSTALLS = {
      macos: { label: "macOS\uFF08Homebrew\uFF09", command: "brew install ffmpeg" },
      windows: { label: "Windows\uFF08winget\uFF09", command: "winget install --id Gyan.FFmpeg -e" },
      linux: { label: "Linux\uFF08Debian / Ubuntu\uFF09", command: "sudo apt update && sudo apt install -y ffmpeg" }
    };
    const FFMPEG_ALL = [
      { os: "macos", label: "macOS\uFF08Homebrew\uFF09", command: "brew install ffmpeg" },
      {
        os: "macos",
        label: "macOS\uFF08\u8FD8\u6CA1\u88C5 Homebrew\uFF09",
        command: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
      },
      { os: "windows", label: "Windows\uFF08winget\uFF09", command: "winget install --id Gyan.FFmpeg -e" },
      { os: "windows", label: "Windows\uFF08Chocolatey\uFF09", command: "choco install ffmpeg" },
      { os: "linux", label: "Linux\uFF08Debian / Ubuntu\uFF09", command: "sudo apt update && sudo apt install -y ffmpeg" },
      { os: "linux", label: "Linux\uFF08Fedora / RHEL / CentOS\uFF09", command: "sudo dnf install -y ffmpeg" }
    ];
    function formatMoney(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return "0";
      const text = number.toFixed(Math.abs(number) >= 1 ? 2 : 4);
      return text.includes(".") ? text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : text;
    }
    const TOKENS = {
      text: "var(--dsw-alias-label-primary, inherit)",
      muted: "var(--dsw-alias-label-caption, #8886)",
      border: "var(--dsw-alias-border-l2, #8884)",
      cardFill: "var(--dsw-alias-settings-card-fill, transparent)",
      controlFill: "var(--dsw-specific-input-major, transparent)",
      primaryFill: "var(--dsw-alias-button-primary-fill, #247bbf)",
      error: "var(--dsw-alias-state-error-primary, #d9534f)",
      success: "var(--dsw-alias-state-success-primary, #2e9e5b)"
    };
    const inputStyle = {
      width: "100%",
      boxSizing: "border-box",
      padding: "7px 9px",
      borderRadius: 8,
      border: `1px solid ${TOKENS.border}`,
      background: TOKENS.controlFill,
      color: TOKENS.text,
      font: "inherit"
    };
    const labelStyle = { display: "block", fontSize: 12, color: TOKENS.muted, marginBottom: 4 };
    const PAGE_CSS = `
      .mov-page { display: flex; flex-direction: column; gap: 14px; padding: 4px 0; color: ${TOKENS.text}; }
      .mov-section { display: flex; flex-direction: column; gap: 10px; }
      .mov-section-title { display: flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 600; color: ${TOKENS.muted}; letter-spacing: .04em; }
      .mov-section-title::after { content: ""; flex: 1 1 auto; height: 1px; background: ${TOKENS.border}; }
      .mov-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px 14px; }
      .mov-field { display: flex; flex-direction: column; min-width: 0; }
      .mov-input:focus, .mov-input:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(36, 123, 191, .22); }
      .mov-switch { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 13px; color: ${TOKENS.text}; cursor: pointer; }
      .mov-switch input { width: 16px; height: 16px; accent-color: ${TOKENS.primaryFill}; cursor: pointer; }
      .mov-card { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border-radius: 10px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.cardFill}; }
      .mov-card-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .mov-card-title { font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 6px 12px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: transparent; color: ${TOKENS.text}; font: inherit; font-size: 12.5px; line-height: 1.2; cursor: pointer; white-space: nowrap; transition: background .15s, border-color .15s, color .15s, opacity .15s; }
      .mov-btn:hover:not(:disabled) { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
      .mov-btn:disabled { opacity: .5; cursor: default; }
      .mov-btn-primary { border-color: ${TOKENS.primaryFill}; background: ${TOKENS.primaryFill}; color: #fff; font-weight: 600; }
      .mov-btn-primary:hover:not(:disabled) { color: #fff; opacity: .88; }
      .mov-btn-sm { padding: 4px 10px; border-radius: 7px; font-size: 12px; }
      .mov-trailing { margin-left: auto; }
      .mov-table { display: flex; flex-direction: column; }
      /* \u65F6\u95F4 / \u7C7B\u578B / \u6A21\u578B / \u8D39\u7528 / \u7ED3\u679C\uFF1A\u65F6\u95F4\u4E0E\u8D39\u7528\u6309\u539F\u5BBD\u5EA6\u56FA\u5B9A\uFF0C\u591A\u51FA\u6765\u7684\u5BBD\u5EA6\u7ED9\u6A21\u578B\u5217 */
      .mov-table-head, .mov-table-row { display: grid; grid-template-columns: 92px minmax(52px, .6fr) minmax(72px, 1.4fr) 92px 56px; align-items: center; gap: 8px; padding: 7px 8px; }
      .mov-table-head { font-size: 11px; color: ${TOKENS.muted}; border-bottom: 1px solid ${TOKENS.border}; }
      .mov-table-row { font-size: 12.5px; border-bottom: 1px solid ${TOKENS.border}; }
      .mov-table-row:last-child { border-bottom: none; }
      .mov-table-row:hover { background: rgba(127, 127, 127, .08); }
      /* \u8D39\u7528\u5217\uFF08\u7B2C 4 \u5217\uFF09\u53F3\u5BF9\u9F50\uFF0C\u8DDF\u4E0A\u9762\u7684\u989D\u5EA6\u6570\u5B57\u5BF9\u9F50 */
      .mov-table-head > :nth-child(4), .mov-table-row > :nth-child(4) { text-align: right; padding-right: 12px; }
      /* \u6A21\u578B ID \u5F88\u957F\uFF08doubao-seedance-2-0-mini-260615\uFF09\uFF0C\u5355\u884C\u7701\u7565\uFF0C\u60AC\u505C\u770B\u5168\u540D */
      .mov-model { min-width: 0; overflow: hidden; color: ${TOKENS.muted}; white-space: nowrap; text-overflow: ellipsis; }
      .mov-num { font-variant-numeric: tabular-nums; }
      .mov-code { flex: 1 1 220px; padding: 5px 9px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.controlFill}; color: ${TOKENS.text}; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
      .mov-tag { flex: 0 0 auto; font-size: 12px; color: ${TOKENS.muted}; }
    `;
    function optionLabel(t, key, option) {
      if (key === "mode") return option === "closeup" ? t("modeCloseup") : t("modeContinuous");
      if (key === "mergeMode") {
        if (option === "reencode") return t("mergeModeReencode");
        return option === "copy" ? t("mergeModeCopy") : t("mergeModeSeamless");
      }
      return option;
    }
    function useSnapshot(form) {
      const [revision, bump] = React.useState(0);
      React.useEffect(() => form.subscribe(() => bump((value) => value + 1)), [form, revision]);
      return form.getSnapshot();
    }
    function same(a, b) {
      return a === b || a === void 0 && b === "" || a === "" && b === void 0;
    }
    function makePage({ form, t }) {
      return function ConfigPage(props) {
        const snapshot = useSnapshot(form);
        const value = snapshot.value || {};
        const [draft, setDraft] = React.useState({});
        const [status, setStatus] = React.useState("idle");
        const [registerStatus, setRegisterStatus] = React.useState("idle");
        const [registerMessage, setRegisterMessage] = React.useState("");
        const [registerEmail, setRegisterEmail] = React.useState(() => {
          const saved = form.getSnapshot().value || {};
          return String(saved.registerEmail || saved.registerUser || "");
        });
        const [registerCode, setRegisterCode] = React.useState("");
        const [codeStatus, setCodeStatus] = React.useState("idle");
        const [codeMessage, setCodeMessage] = React.useState("");
        const [codeCooldown, setCodeCooldown] = React.useState(0);
        const emailLocked = codeCooldown > 0;
        const [quota, setQuota] = React.useState(null);
        const [quotaStatus, setQuotaStatus] = React.useState("idle");
        const [quotaMessage, setQuotaMessage] = React.useState("");
        const [quotaAt, setQuotaAt] = React.useState("");
        const [usage, setUsage] = React.useState(null);
        const [usageStatus, setUsageStatus] = React.useState("idle");
        const [usageMessage, setUsageMessage] = React.useState("");
        const [showAllFfmpeg, setShowAllFfmpeg] = React.useState(false);
        const [copiedFfmpeg, setCopiedFfmpeg] = React.useState("");
        const restoreTried = React.useRef(false);
        React.useEffect(() => {
          if (restoreTried.current) return;
          restoreTried.current = true;
          syncDeviceIdentity().catch(() => {
          });
          const snap = form.getSnapshot() || {};
          if (snap.secrets?.apiKey || (snap.value || {}).apiKey) {
            loadQuota().catch(() => {
            });
            loadUsage().catch(() => {
            });
            return;
          }
          lookupOwnKey().catch(() => {
          });
        }, []);
        if (props && props.view === "summary") {
          const configured = Boolean(value.model) || Boolean(snapshot.secrets?.apiKey);
          const text = configured ? t("summary", { provider: t("providerNewapi"), model: value.model || "-", duration: value.duration ?? "-" }) : t("summaryEmpty");
          return h("span", { style: { color: TOKENS.muted } }, text);
        }
        const pending = Object.entries(draft).filter(([key, next]) => !same(value[key], next));
        const edit = (key, next) => setDraft((current) => ({ ...current, [key]: next }));
        const clear = (key) => setDraft((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        async function save() {
          setStatus("saving");
          let ok = true;
          for (const [key, next] of pending) {
            const accepted = await form.set(key, next);
            if (accepted) clear(key);
            else ok = false;
          }
          setStatus(ok ? "saved" : "failed");
        }
        async function reset() {
          const overridden = Object.keys(snapshot.user || {});
          if (!overridden.length) return;
          setStatus("saving");
          for (const key of overridden) await form.unset(key);
          setDraft({});
          setStatus("saved");
        }
        function registerApiRoot() {
          const configured = String(value.registerApi || "").trim();
          return (configured || DEFAULT_REGISTER_API).replace(/\/+$/, "");
        }
        function deviceIdentity() {
          const ID_KEY = "metaontic-video.device-id";
          const SECRET_KEY = "metaontic-video.device-secret";
          const rand = () => Math.random().toString(36).slice(2, 10);
          let id = `dsh-${rand()}${Date.now().toString(36)}`;
          let secret = `dsk-${rand()}${rand()}${rand()}`;
          try {
            const savedId = window.localStorage.getItem(ID_KEY);
            const savedSecret = window.localStorage.getItem(SECRET_KEY);
            if (savedId) id = savedId;
            else window.localStorage.setItem(ID_KEY, id);
            if (savedSecret) secret = savedSecret;
            else window.localStorage.setItem(SECRET_KEY, secret);
          } catch {
          }
          return { id, secret };
        }
        function deviceFingerprint() {
          const pick = (read) => {
            try {
              const value2 = read();
              return value2 ? String(value2).slice(0, 120) : void 0;
            } catch {
              return void 0;
            }
          };
          const nav = () => window.navigator;
          const info = {
            app: "Harness",
            plugin: "metaontic-video",
            platform: pick(() => nav().userAgentData?.platform || nav().platform),
            os: pick(() => nav().userAgentData?.platform || nav().platform),
            language: pick(() => nav().language),
            timezone: pick(() => window.Intl?.DateTimeFormat().resolvedOptions().timeZone),
            screen: pick(() => `${window.screen?.width}x${window.screen?.height}`),
            agent: pick(() => nav().userAgent)
          };
          return Object.fromEntries(Object.entries(info).filter(([, v]) => v !== void 0));
        }
        function deviceLabel(info) {
          const platform = info?.platform || info?.os;
          return platform ? `Harness-${platform}` : "Harness";
        }
        function deviceWrites(device = void 0) {
          const identity = device || deviceIdentity();
          const current = form.getSnapshot().value || {};
          const writes = [];
          if (!same(current.deviceId, identity.id)) writes.push(["deviceId", identity.id]);
          if (!same(current.deviceSecret, identity.secret)) {
            writes.push(["deviceSecret", identity.secret]);
          }
          return writes;
        }
        async function syncDeviceIdentity() {
          try {
            for (const [key, next] of deviceWrites()) {
              const accepted = await form.set(key, next);
              if (accepted) clear(key);
            }
          } catch {
          }
        }
        async function callRegister(url, init = {}) {
          const controller = typeof AbortController === "function" ? new AbortController() : null;
          const timer = controller ? window.setTimeout(() => controller.abort(), 9e4) : null;
          const token = String(value.registerToken || DEFAULT_REGISTER_TOKEN);
          const options = { ...init || {} };
          options.headers = {
            accept: "application/json",
            "x-register-token": token,
            ...init && init.headers || {}
          };
          let response;
          try {
            response = await fetch(url, {
              signal: controller ? controller.signal : void 0,
              ...options
            });
          } finally {
            if (timer) window.clearTimeout(timer);
          }
          const text = await response.text();
          let body = null;
          try {
            body = text ? JSON.parse(text) : null;
          } catch {
            body = null;
          }
          const payload = body && typeof body === "object" && "data" in body ? body.data : body;
          if (!response.ok || body && typeof body === "object" && body.code) {
            const failure = new Error(
              body && (body.message || body.detail) || text.slice(0, 200) || `HTTP ${response.status}`
            );
            failure.status = response.status;
            throw failure;
          }
          return payload || {};
        }
        async function applyRegistration(result, fallbackBase, device) {
          const writes = [
            ["apiKey", result.api_key],
            ["keyOrigin", "register"],
            ["baseUrl", result.base_url || fallbackBase || registerApiRoot()],
            ...await deviceWrites(device)
          ];
          const account = result.email || result.display_name || "";
          if (account) writes.push(["registerEmail", account]);
          if (result.model) writes.push(["model", result.model]);
          let ok = true;
          for (const [key, next] of writes) {
            const accepted = await form.set(key, next);
            if (accepted) clear(key);
            else ok = false;
          }
          setRegisterStatus(ok ? "ok" : "partial");
          loadQuota().catch(() => {
          });
          loadUsage().catch(() => {
          });
          return ok;
        }
        async function lookupOwnKey() {
          const device = deviceIdentity();
          const result = await callRegister(`${registerApiRoot()}/api/v1/register/lookup`, {
            method: "POST",
            headers: { "content-type": "application/json", accept: "application/json" },
            body: JSON.stringify({ device_id: device.id, device_secret: device.secret })
          });
          if (!result.api_key) throw new Error(t("registerNoKey"));
          await applyRegistration(result, null, device);
          setRegisterStatus("restored");
          return result;
        }
        function startCooldown(seconds) {
          const total = Math.max(Math.round(Number(seconds) || 0), 0);
          if (!total) return;
          setCodeCooldown(total);
          const tick = (left) => {
            if (left <= 0) {
              setCodeCooldown(0);
              return;
            }
            setCodeCooldown(left);
            window.setTimeout(() => tick(left - 1), 1e3);
          };
          window.setTimeout(() => tick(total - 1), 1e3);
        }
        async function sendEmailCode() {
          const account = registerEmail.trim();
          if (!account) {
            setCodeStatus("failed");
            setCodeMessage(t("registerNeedEmail"));
            return;
          }
          setCodeStatus("working");
          setCodeMessage("");
          try {
            const status2 = await callRegister(`${registerApiRoot()}/api/v1/register/status`);
            if (!status2.enabled) {
              setCodeStatus("failed");
              setCodeMessage(t("registerDisabled", { message: status2.hint || "-" }));
              return;
            }
            const result = await callRegister(`${registerApiRoot()}/api/v1/register/email/code`, {
              method: "POST",
              headers: { "content-type": "application/json", accept: "application/json" },
              body: JSON.stringify({ email: account })
            });
            setCodeStatus("sent");
            setCodeMessage(t("registerCodeSent", { email: result.email || account }));
            startCooldown(result.retry_after ?? 60);
            setRegisterStatus("idle");
            setRegisterMessage("");
          } catch (error) {
            setCodeStatus("failed");
            setCodeMessage(error?.message || String(error));
          }
        }
        async function register() {
          const root = registerApiRoot();
          const account = registerEmail.trim();
          const code = registerCode.trim();
          if (!account) {
            setRegisterStatus("failed");
            setRegisterMessage(t("registerNeedEmail"));
            return;
          }
          if (!code) {
            setRegisterStatus("failed");
            setRegisterMessage(t("registerNeedCode"));
            return;
          }
          setRegisterStatus("working");
          setRegisterMessage("");
          const device = deviceIdentity();
          const fingerprint = deviceFingerprint();
          try {
            const status2 = await callRegister(`${root}/api/v1/register/status`);
            if (!status2.enabled) {
              setRegisterStatus("disabled");
              setRegisterMessage(t("registerDisabled", { message: status2.hint || "-" }));
              return;
            }
            const result = await callRegister(`${root}/api/v1/register`, {
              method: "POST",
              headers: { "content-type": "application/json", accept: "application/json" },
              body: JSON.stringify({
                email: account,
                code,
                device_id: device.id,
                device_secret: device.secret,
                device_info: fingerprint,
                note: `Harness \u63D2\u4EF6\u8BBE\u7F6E\u9875\u6CE8\u518C\uFF08${deviceLabel(fingerprint)}\uFF09`
              })
            });
            if (!result.api_key) {
              setRegisterStatus("failed");
              setRegisterMessage(t("registerNoKey"));
              return;
            }
            await applyRegistration(result, status2.base_url || root, device);
          } catch (error) {
            if (error?.status === 409 || error?.status === 404) {
              try {
                await lookupOwnKey();
                return;
              } catch {
              }
            }
            setRegisterStatus("failed");
            setRegisterMessage(t("registerFailed", { message: error?.message || String(error) }));
          }
        }
        async function loadQuota() {
          const device = deviceIdentity();
          setQuotaStatus("working");
          setQuotaMessage("");
          try {
            const result = await callRegister(`${registerApiRoot()}/api/v1/register/quota`, {
              method: "POST",
              headers: { "content-type": "application/json", accept: "application/json" },
              body: JSON.stringify({ device_id: device.id, device_secret: device.secret })
            });
            setQuota(result);
            setQuotaAt((/* @__PURE__ */ new Date()).toLocaleTimeString());
            setQuotaStatus("ok");
            return result;
          } catch (error) {
            setQuota(null);
            setQuotaStatus("failed");
            setQuotaMessage(error?.status === 404 ? t("quotaNotRegistered") : t("quotaFailed", { message: error?.message || String(error) }));
            throw error;
          }
        }
        async function loadUsage() {
          const device = deviceIdentity();
          setUsageStatus("working");
          setUsageMessage("");
          try {
            const result = await callRegister(`${registerApiRoot()}/api/v1/usage/list`, {
              method: "POST",
              headers: { "content-type": "application/json", accept: "application/json" },
              body: JSON.stringify({
                device_id: device.id,
                device_secret: device.secret,
                limit: 10
              })
            });
            setUsage(result);
            setUsageStatus("ok");
            return result;
          } catch (error) {
            setUsage(null);
            setUsageStatus("failed");
            setUsageMessage(error?.status === 404 ? t("quotaNotRegistered") : t("usageFailed", { message: error?.message || String(error) }));
            throw error;
          }
        }
        function control(field) {
          const current = draft[field.key] !== void 0 ? draft[field.key] : value[field.key];
          const id = `metaontic-video-${field.key}`;
          if (field.kind === "switch") {
            return h(
              "label",
              { htmlFor: id, className: "mov-switch" },
              h("input", {
                id,
                "data-field": field.key,
                type: "checkbox",
                checked: Boolean(current),
                onChange: (event) => edit(field.key, event.target.checked)
              }),
              h("span", null, t(field.key))
            );
          }
          if (field.kind === "select") {
            return h("select", {
              id,
              "data-field": field.key,
              className: "mov-input",
              style: inputStyle,
              value: current ?? "",
              onChange: (event) => edit(field.key, event.target.value)
            }, (SELECTS[field.key] || []).map((option) => h("option", { key: option, value: option }, optionLabel(t, field.key, option))));
          }
          return h("input", {
            id,
            "data-field": field.key,
            className: "mov-input",
            style: inputStyle,
            type: field.kind === "number" ? "number" : field.secret ? "password" : "text",
            value: current ?? "",
            placeholder: field.secret && snapshot.secrets?.apiKey ? t("apiKeyConfigured") : "",
            onChange: (event) => edit(
              field.key,
              field.kind === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value
            )
          });
        }
        const hints = {};
        function fieldCell(field) {
          return h("div", { key: field.key, className: "mov-field" }, [
            field.kind === "switch" ? null : h("label", { key: "label", style: labelStyle, htmlFor: `metaontic-video-${field.key}` }, t(field.key)),
            control(field),
            hints[field.key] ? h("span", { key: "hint", style: { ...labelStyle, marginTop: 4 } }, hints[field.key]) : null
          ]);
        }
        const rows = SECTIONS.map((section) => h("div", { key: section.key, className: "mov-section" }, [
          h("div", { key: "title", className: "mov-section-title" }, t(section.key)),
          h(
            "div",
            { key: "grid", className: "mov-grid" },
            section.fields.map((key) => fieldCell(FIELD_BY_KEY[key])).filter(Boolean)
          )
        ]));
        const footer = h("div", { key: "footer", className: "mov-card-head", style: { gap: 12, marginTop: 2 } }, [
          h("button", {
            key: "save",
            "data-action": "save",
            type: "button",
            className: "mov-btn mov-btn-primary",
            disabled: status === "saving" || snapshot.writable === false,
            onClick: save
          }, status === "saving" ? t("saving") : t("save")),
          h("button", {
            key: "reset",
            "data-action": "reset",
            type: "button",
            className: "mov-btn",
            disabled: !Object.keys(snapshot.user || {}).length,
            onClick: reset
          }, t("reset")),
          h("span", {
            key: "status",
            style: {
              fontSize: 12,
              color: status === "failed" ? TOKENS.error : status === "saved" ? TOKENS.success : TOKENS.muted
            }
          }, status === "saved" ? t("saved") : status === "failed" ? t("saveFailed") : pending.length ? t("dirty") : t("clean"))
        ]);
        const registerMessageColors = {
          ok: TOKENS.success,
          restored: TOKENS.success,
          partial: TOKENS.success,
          disabled: TOKENS.error,
          failed: TOKENS.error
        };
        const serverIssuedKey = value.keyOrigin === "register" || Boolean(value.deviceId && value.deviceSecret && value.registerEmail);
        const keyReady = Boolean(snapshot.secrets?.apiKey || value.apiKey) && serverIssuedKey;
        const registerText = registerStatus === "ok" ? t("registerOk") : registerStatus === "partial" ? t("registerPartial") : registerStatus === "restored" ? t("registerRestored") : registerMessage;
        const quotaSymbol = quota && quota.currency_symbol ? quota.currency_symbol : "\xA5";
        const money = (field) => `${quotaSymbol}${formatMoney(quota ? quota[field] : 0)}`;
        const quotaReady = quotaStatus === "ok" && quota;
        const quotaText = quotaReady ? `${t("quotaSummary", {
          remain: quota.unlimited_quota ? t("quotaUnlimited") : money("remain_amount"),
          used: money("used_amount"),
          total: money("total_amount")
        })} \xB7 ${t("quotaUpdatedAt", { time: quotaAt })}` : keyReady ? t("quotaLoading") : t("quotaNoKey");
        const os = currentOs();
        const primaryInstall = FFMPEG_INSTALLS[os] || FFMPEG_INSTALLS.macos;
        const installRows = showAllFfmpeg ? FFMPEG_ALL : [primaryInstall];
        const ffmpegBox = h("div", {
          key: "ffmpeg",
          "data-field": "ffmpeg",
          className: "mov-card"
        }, [
          h("div", { key: "head", className: "mov-card-head" }, [
            h("span", { key: "title", className: "mov-card-title" }, t("ffmpegTitle")),
            h("button", {
              key: "toggle",
              "data-action": "ffmpeg-systems",
              type: "button",
              className: "mov-btn mov-btn-sm mov-trailing",
              onClick: () => setShowAllFfmpeg((current) => !current)
            }, showAllFfmpeg ? t("ffmpegLess") : t("ffmpegMore"))
          ]),
          h("span", { key: "body", style: labelStyle }, t("ffmpegBody")),
          h("span", { key: "for", style: labelStyle }, t("ffmpegInstallFor")),
          ...installRows.map((item, index) => h("div", {
            key: `install-${index}`,
            "data-field": "ffmpegInstall",
            style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }
          }, [
            h("span", { key: "label", className: "mov-tag" }, item.label),
            h("code", {
              key: "command",
              "data-field": "ffmpegCommand",
              className: "mov-code"
            }, item.command),
            h("button", {
              key: "copy",
              "data-action": "ffmpeg-copy",
              type: "button",
              className: "mov-btn mov-btn-sm",
              onClick: () => copyCommand(item.command)
            }, copiedFfmpeg === item.command ? t("ffmpegCopied") : t("ffmpegCopy"))
          ])),
          h("span", { key: "after", style: labelStyle }, t("ffmpegAfter"))
        ]);
        const quotaBox = h("div", {
          key: "quota",
          "data-field": "quota",
          className: "mov-card"
        }, [
          h("div", { key: "head", className: "mov-card-head" }, [
            h("span", { key: "title", className: "mov-card-title" }, t("quotaTitle")),
            keyReady ? h("button", {
              key: "refresh",
              "data-action": "quota-refresh",
              type: "button",
              className: "mov-btn mov-btn-sm mov-trailing",
              disabled: quotaStatus === "working",
              onClick: () => {
                loadQuota().catch(() => {
                });
              }
            }, t("quotaRefresh")) : null
          ]),
          h("div", { key: "text", style: { display: "flex", flexDirection: "column", gap: 2 } }, [
            h("span", {
              key: "value",
              "data-field": "quotaValue",
              style: { fontSize: 12, color: quotaReady ? TOKENS.success : TOKENS.muted }
            }, quotaText),
            quotaMessage ? h("span", { key: "message", style: labelStyle }, quotaMessage) : null
          ])
        ]);
        function copyCommand(command) {
          try {
            const result = window.navigator?.clipboard?.writeText(command);
            if (result && typeof result.then === "function") {
              result.then(() => {
                setCopiedFfmpeg(command);
                window.setTimeout(() => setCopiedFfmpeg(""), 2e3);
              }, () => {
              });
            }
          } catch {
          }
        }
        function usageTime(value2) {
          if (!value2) return "-";
          const at = new Date(value2);
          if (Number.isNaN(at.getTime())) return "-";
          return at.toLocaleString(void 0, {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          });
        }
        const usageRows = usage && Array.isArray(usage.items) ? usage.items : [];
        const usageSymbol = usage && usage.currency_symbol ? usage.currency_symbol : "\xA5";
        const usageSummaryText = usage ? usageRows.length ? `${t("usageSummary", {
          count: usage.count,
          amount: `${usageSymbol}${formatMoney(usage.amount_sum)}`
        })}${usage.truncated ? ` \xB7 ${t("usageMore", { count: usage.count })}` : ""}` : t("usageEmpty") : usageStatus === "working" ? t("usageLoading") : t("usageKeyMissing");
        const usageBox = keyReady ? h("div", {
          key: "usage",
          "data-field": "usage",
          className: "mov-card"
        }, [
          h("div", { key: "head", className: "mov-card-head" }, [
            h(
              "span",
              { key: "title", className: "mov-card-title" },
              t("usageTitle", { days: usage ? usage.window_days : 7 })
            ),
            h("span", {
              key: "summary",
              "data-field": "usageSummary",
              style: { fontSize: 12, color: TOKENS.muted, flex: "1 1 200px" }
            }, usageSummaryText),
            h("button", {
              key: "refresh",
              "data-action": "usage-refresh",
              type: "button",
              className: "mov-btn mov-btn-sm",
              disabled: usageStatus === "working",
              onClick: () => {
                loadUsage().catch(() => {
                });
              }
            }, t("usageRefresh"))
          ]),
          usageRows.length ? h("div", {
            key: "table",
            className: "mov-table"
          }, [
            h("div", {
              key: "head-row",
              "data-field": "usage-head",
              className: "mov-table-head"
            }, [
              h("span", { key: "time" }, t("usageColTime")),
              h("span", { key: "kind" }, t("usageColKind")),
              h("span", { key: "model" }, t("usageColModel")),
              h("span", { key: "cost" }, t("usageColCost")),
              h("span", { key: "status" }, t("usageColStatus"))
            ]),
            ...usageRows.map((row, index) => h("div", {
              key: `${row.id}-${index}`,
              "data-field": "usage-row",
              className: "mov-table-row"
            }, [
              h(
                "span",
                { key: "time", className: "mov-num", style: { color: TOKENS.muted } },
                usageTime(row.created_at)
              ),
              h("span", { key: "kind" }, row.kind_label || ""),
              // 模型 ID 是这一行最有用的信息之一（换过模型一眼能看出来是哪次用的哪个）
              h("span", {
                key: "model",
                className: "mov-model",
                title: row.model || ""
              }, row.model || "\u2014"),
              h("span", {
                key: "amount",
                "data-field": "usage-amount",
                className: "mov-num",
                style: { color: row.status === "succeeded" ? TOKENS.success : TOKENS.muted }
              }, `${usageSymbol}${formatMoney(row.amount)}`),
              h("span", {
                key: "status",
                style: { color: row.status === "succeeded" ? TOKENS.success : TOKENS.error }
              }, row.status === "succeeded" ? t("usageStatusOk") : t("usageStatusFailed"))
            ]))
          ]) : null,
          usageMessage ? h("span", { key: "message", style: labelStyle }, usageMessage) : null
        ]) : null;
        const registerBox = keyReady ? null : h("div", {
          key: "register",
          className: "mov-card",
          style: { gap: 10 }
        }, [
          h("div", { key: "text", style: { display: "flex", flexDirection: "column", gap: 2 } }, [
            h(
              "span",
              { key: "title", className: "mov-card-title" },
              t("registerTitle")
            ),
            h("span", { key: "hint", style: labelStyle }, t("registerHint"))
          ]),
          h("div", { key: "form", style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } }, [
            h("input", {
              key: "email",
              "data-field": "registerEmail",
              type: "text",
              className: "mov-input",
              value: registerEmail,
              placeholder: t("registerEmailPlaceholder"),
              "aria-label": t("registerEmail"),
              // 验证码已经发出去了：冷却期内不让改邮箱，免得「码发到 A、注册填 B」
              disabled: emailLocked,
              "data-locked": emailLocked ? "true" : "false",
              title: emailLocked ? t("registerEmailLocked") : void 0,
              onChange: (event) => setRegisterEmail(event.target.value),
              style: {
                ...inputStyle,
                flex: "0 1 180px",
                width: "auto",
                opacity: emailLocked ? 0.6 : 1,
                cursor: emailLocked ? "not-allowed" : "text"
              }
            }),
            h("button", {
              key: "code",
              "data-action": "send-code",
              type: "button",
              className: "mov-btn",
              disabled: codeStatus === "working" || codeCooldown > 0 || !registerEmail.trim(),
              onClick: () => {
                sendEmailCode().catch(() => {
                });
              }
            }, codeCooldown > 0 ? t("registerCodeCooldown", { seconds: codeCooldown }) : codeStatus === "working" ? t("registerCodeSending") : t("registerCodeSend")),
            h("input", {
              key: "code-input",
              "data-field": "registerCode",
              type: "text",
              inputMode: "numeric",
              className: "mov-input",
              value: registerCode,
              placeholder: t("registerCodePlaceholder"),
              "aria-label": t("registerCode"),
              onChange: (event) => setRegisterCode(event.target.value),
              style: { ...inputStyle, flex: "0 1 110px", width: "auto" }
            }),
            h("button", {
              key: "button",
              "data-action": "register",
              type: "button",
              className: "mov-btn mov-btn-primary",
              disabled: registerStatus === "working" || !registerEmail.trim() || !registerCode.trim() || snapshot.writable === false,
              onClick: register
            }, registerStatus === "working" ? t("registerWorking") : t("register"))
          ]),
          codeMessage ? h("span", {
            key: "code-message",
            "data-field": "codeMessage",
            style: {
              flex: "1 1 100%",
              fontSize: 12,
              color: codeStatus === "failed" ? TOKENS.error : TOKENS.success
            }
          }, codeMessage) : null,
          registerText ? h("span", {
            key: "message",
            style: { flex: "1 1 100%", fontSize: 12, color: registerMessageColors[registerStatus] || TOKENS.muted }
          }, registerText) : null
        ]);
        let notice = null;
        if (snapshot.status === "loading") notice = t("loading");
        else if (snapshot.value === void 0) notice = t("unavailable");
        else if (snapshot.writable === false) notice = t("readOnly");
        const blobs = notice && !snapshot.value ? [] : [ffmpegBox, registerBox, quotaBox, usageBox, footer];
        return h("div", { className: "mov-page" }, [
          // hover / focus 这类效果内联样式写不出来，集中在这张样式表里（class 都带 mov- 前缀）。
          h("style", { key: "styles" }, PAGE_CSS),
          notice ? h("p", { key: "notice", style: { margin: 0, fontSize: 12, color: TOKENS.muted } }, notice) : null,
          ...notice && !snapshot.value ? [] : rows,
          ...blobs
        ]);
      };
    }
    return {
      inject: ["slots", "locale", "configForms"],
      apply(ctx) {
        const t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), "metaontic-video: dictionaries");
        const form = ctx.configForms.get(NAMESPACE);
        const Page = makePage({ form, t });
        ctx.effect(() => ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
          name: "plugins.bundle.config",
          key: NAMESPACE,
          locale: NS
        }, Page)), "metaontic-video: configuration page");
      }
    };
  }
});
