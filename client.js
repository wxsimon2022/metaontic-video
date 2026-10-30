window.__ModuleLoader__.load({
  id: "metaontic-video",
  factory(require2) {
    const React = require2("react");
    const h = React.createElement;
    const NAMESPACE = "metaontic-video";
    const NS = "settings.metaonticVideo";
    const zh = {
      summaryEmpty: "\u672A\u914D\u7F6E\uFF1A\u5230\u63D2\u4EF6\u8BBE\u7F6E\u9875\u70B9\u300C\u767B\u5F55\u300D\u9886\u4E00\u628A\u5BC6\u94A5\u3002",
      summary: "{provider} \xB7 {model}",
      providerNewapi: "New API \u4E2D\u8F6C\u7AD9",
      apiKeyConfigured: "\u5DF2\u914D\u7F6E\uFF0C\u7559\u7A7A\u8868\u793A\u4FDD\u6301\u539F\u503C",
      model: "\u6A21\u578B",
      modelHint: "mini \u66F4\u7701\uFF08\u9ED8\u8BA4\uFF09\uFF1Bfast \u540C\u4E00\u4EE3\u7684\u52A0\u901F\u7248\uFF0C\u5355\u4EF7\u7EA6 1.6 \u500D\u3002",
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
      registerTitle: "\u6CE8\u518C\u63D2\u4EF6",
      registerHint: "\u586B\u90AE\u7BB1 \u2192 \u83B7\u53D6\u9A8C\u8BC1\u7801 \u2192 \u767B\u5F55\uFF1B\u90AE\u7BB1\u5373\u8D26\u53F7\uFF0C\u4E00\u4E2A\u90AE\u7BB1\u4E00\u628A Key\u3002",
      registerEmailPlaceholder: "\u4F60\u7684\u90AE\u7BB1\uFF0C\u4F8B\u5982 name@example.com",
      registerCode: "\u9A8C\u8BC1\u7801",
      registerCodePlaceholder: "\u9A8C\u8BC1\u7801",
      registerCodeSend: "\u83B7\u53D6\u9A8C\u8BC1\u7801",
      registerCodeSending: "\u53D1\u9001\u4E2D\u2026",
      registerCodeCooldown: "{seconds} \u79D2\u540E\u91CD\u53D1",
      registerCodeSent: "\u9A8C\u8BC1\u7801\u5DF2\u53D1\u5230 {email}\uFF1A5 \u5206\u949F\u5185\u6709\u6548\uFF0C\u586B\u8FDB\u6765\u70B9\u53F3\u8FB9\u7684\u6309\u94AE\u5373\u53EF\u3002",
      registerEmailLocked: "\u9A8C\u8BC1\u7801\u521A\u53D1\u5230\u4E0A\u9762\u8FD9\u4E2A\u90AE\u7BB1\uFF1A\u7B49\u5012\u8BA1\u65F6\u7ED3\u675F\u624D\u80FD\u6539\u3002",
      registerNeedEmail: "\u5148\u586B\u90AE\u7BB1\uFF0C\u518D\u70B9\u300C\u83B7\u53D6\u9A8C\u8BC1\u7801\u300D\u3002",
      registerNeedCode: "\u5148\u586B\u90AE\u4EF6\u91CC\u6536\u5230\u7684\u9A8C\u8BC1\u7801\u3002",
      registerRestored: "\u5DF2\u627E\u56DE\u672C\u673A\u5BC6\u94A5\uFF1A\u8FD9\u53F0\u8BBE\u5907\u4E4B\u524D\u9886\u8FC7\u7684\u90A3\u628A\u5E2E\u4F60\u586B\u597D\u4E86\uFF0C\u70B9\u300C\u4FDD\u5B58\u300D\u5373\u53EF\u3002",
      quotaTitle: "\u989D\u5EA6\uFF08\u5F53\u524D\u8FD9\u628A Key\uFF09",
      quotaRemain: "\u5269\u4F59",
      quotaUsed: "\u5DF2\u7528",
      quotaTotal: "\u603B\u989D\u5EA6",
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
      versionTitle: "\u63D2\u4EF6\u7248\u672C",
      versionCurrent: "\u5F53\u524D\u7248\u672C v{version}",
      versionCheck: "\u68C0\u67E5\u66F4\u65B0",
      versionChecking: "\u68C0\u67E5\u4E2D\u2026",
      versionLatest: "\u5DF2\u662F\u6700\u65B0\u7248\u672C",
      versionNew: "\u6709\u65B0\u7248\u672C v{version}",
      versionFailed: "\u68C0\u67E5\u66F4\u65B0\u5931\u8D25\uFF1A{message}",
      versionHint: "\u66F4\u65B0\u65B9\u5F0F\uFF1A\u63D2\u4EF6 \u2192 \u5DF2\u5B89\u88C5 \u2192 MetaOnticVideo \u2192 \u5378\u8F7D\uFF0C\u518D\u70B9\u300C\u6DFB\u52A0\u63D2\u4EF6\u300D\u7C98\u8D34\u4ED3\u5E93\u5730\u5740\uFF1B\u6216\u8005\u5728\u7EC8\u7AEF\u8DD1\u4E0B\u9762\u8FD9\u6761\u547D\u4EE4\u3002\u66F4\u65B0\u5B8C\u91CD\u542F Harness \u624D\u751F\u6548\u3002",
      versionCopy: "\u590D\u5236\u547D\u4EE4",
      versionCopied: "\u5DF2\u590D\u5236",
      versionCheckedAt: "\u68C0\u67E5\u4E8E {time}",
      sectionGeneration: "\u751F\u6210\u53C2\u6570",
      sectionMerge: "\u5408\u5E76\u4E0E\u8F93\u51FA",
      sectionAdvanced: "\u9AD8\u7EA7",
      register: "\u767B\u5F55",
      registerWorking: "\u767B\u5F55\u4E2D\u2026",
      registerOk: "\u767B\u5F55\u6210\u529F\uFF1A\u4E0A\u6E38 / Key / \u5730\u5740 / \u6A21\u578B\u90FD\u5199\u597D\u4E86\uFF0C\u5BBF\u4E3B\u91CD\u8F7D\u914D\u7F6E\u540E\u751F\u6548\u3002",
      registerPartial: "\u5DF2\u62FF\u5230\u5BC6\u94A5\uFF0C\u4F46\u6709\u5B57\u6BB5\u5BBF\u4E3B\u6CA1\u63A5\u53D7\uFF0C\u8BF7\u68C0\u67E5\u540E\u624B\u52A8\u4FDD\u5B58\u3002",
      registerFailed: "\u767B\u5F55\u5931\u8D25\uFF1A{message}",
      registerDisabled: "\u6CE8\u518C\u670D\u52A1\u4E0D\u53EF\u7528\uFF1A{message}",
      registerNoKey: "\u6CE8\u518C\u670D\u52A1\u6CA1\u6709\u8FD4\u56DE\u5BC6\u94A5\uFF08\u540E\u7AEF\u4E2D\u8F6C\u7AD9\u914D\u7F6E\u53EF\u80FD\u6709\u95EE\u9898\uFF09\u3002",
      mode: "\u7EED\u62CD\u65B9\u5F0F",
      modeContinuous: "\u540C\u673A\u4F4D\u8FDE\u7EED",
      modeCloseup: "\u5207\u8FD1\u666F",
      ratio: "\u753B\u9762\u6BD4\u4F8B",
      generateAudio: "\u751F\u6210\u97F3\u9891",
      watermark: "\u52A0\u6C34\u5370",
      extraParams: "\u989D\u5916\u53C2\u6570\uFF08JSON\uFF09",
      pollIntervalMs: "\u8F6E\u8BE2\u95F4\u9694\uFF08\u6BEB\u79D2\uFF09",
      maxWaitMs: "\u5355\u6B21\u6700\u957F\u7B49\u5F85\uFF08\u6BEB\u79D2\uFF09",
      save: "\u4FDD\u5B58",
      reset: "\u91CD\u7F6E\u63D2\u4EF6",
      saving: "\u4FDD\u5B58\u4E2D\u2026",
      saved: "\u5DF2\u4FDD\u5B58\uFF0C\u5BBF\u4E3B\u91CD\u8F7D\u914D\u7F6E\u540E\u751F\u6548\u3002",
      saveFailed: "\u5BBF\u4E3B\u62D2\u7EDD\u4E86\u8FD9\u6B21\u5199\u5165\uFF0C\u8BF7\u68C0\u67E5\u5B57\u6BB5\u53D6\u503C\u3002",
      dirty: "\u6709\u672A\u4FDD\u5B58\u7684\u6539\u52A8",
      loading: "\u8BFB\u53D6\u914D\u7F6E\u4E2D\u2026",
      unavailable: "\u5BBF\u4E3B\u8FD8\u6CA1\u6709\u628A\u672C\u6761\u76EE\u5F53\u4F5C\u53EF\u7F16\u8F91\u8BBE\u7F6E\u9879\u63D0\u4F9B\u670D\u52A1\uFF08\u914D\u7F6E\u547D\u540D\u7A7A\u95F4 metaontic-video \u672A\u5C31\u7EEA\uFF09\u3002\u82E5 profile \u7684 cordis.patch.yml \u91CC\u5DF2\u6709\u8BE5\u6761\u76EE\uFF0C\u8BF7\u91CD\u542F Harness \u8BA9\u5BBF\u4E3B\u91CD\u65B0\u52A0\u8F7D\uFF1B\u91CD\u542F\u540E\u4ECD\u662F\u8FD9\u53E5\u8BDD\uFF0C\u5C31\u662F\u5BBF\u4E3B\u7248\u672C\u4E0E\u63D2\u4EF6\u7684\u8BBE\u7F6E\u63A5\u53E3\u4E0D\u5339\u914D\u3002",
      readOnly: "\u5F53\u524D profile \u4E0D\u63A5\u53D7\u8868\u5355\u5199\u5165\u3002"
    };
    const en = {
      summaryEmpty: 'Not configured: open the plugin settings and click "Log in".',
      summary: "{provider} \xB7 {model}",
      providerNewapi: "New API relay",
      apiKeyConfigured: "Configured; leave empty to keep it",
      model: "Model",
      modelHint: "mini is the cheaper default; fast is the faster sibling at about 1.6\xD7 the price.",
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
      registerTitle: "Register the plugin",
      registerHint: "Email \u2192 verification code \u2192 log in. One email, one key.",
      registerEmailPlaceholder: "you@example.com",
      registerCode: "Verification code",
      registerCodePlaceholder: "verification code",
      registerCodeSend: "Send code",
      registerCodeSending: "Sending\u2026",
      registerCodeCooldown: "Resend in {seconds}s",
      registerCodeSent: "Code sent to {email} \u2014 valid for 5 minutes.",
      registerEmailLocked: "Code just went to this address \u2014 edit it after the countdown.",
      registerNeedEmail: "Type your email before requesting a code.",
      registerNeedCode: "Type the code from the email first.",
      registerRestored: "Restored the key issued to this device; click Save to apply.",
      quotaTitle: "Quota (current key)",
      quotaRemain: "Remaining",
      quotaUsed: "Used",
      quotaTotal: "Total",
      quotaUnlimited: "Unlimited",
      quotaLoading: "Reading quota\u2026",
      quotaRefresh: "Refresh quota",
      quotaNoKey: "No key yet \u2014 remaining / used quota shows here after registration.",
      quotaNotRegistered: "The service has no registration for this device (new device or cleared data) \u2014 ask an admin to reset it.",
      quotaFailed: "Failed to read quota: {message}",
      quotaUpdatedAt: "updated {time}",
      versionTitle: "Plugin version",
      versionCurrent: "Installed v{version}",
      versionCheck: "Check for updates",
      versionChecking: "Checking\u2026",
      versionLatest: "Up to date",
      versionNew: "v{version} is available",
      versionFailed: "Update check failed: {message}",
      versionHint: 'To update: Plugins \u2192 Installed \u2192 MetaOnticVideo \u2192 Uninstall, then "Add plugin" and paste the repository URL; or run the command below. Restart Harness afterwards for it to take effect.',
      versionCopy: "Copy command",
      versionCopied: "Copied",
      versionCheckedAt: "checked {time}",
      register: "Log in",
      registerWorking: "Logging in\u2026",
      registerOk: "Logged in: provider, key, base URL and model written; applies after the config reload.",
      registerPartial: "Key received, but some fields were rejected; please review and save manually.",
      registerFailed: "Log in failed: {message}",
      registerDisabled: "Register service unavailable: {message}",
      registerNoKey: "The register service returned no key (check the relay configuration).",
      sectionGeneration: "Generation",
      sectionMerge: "Merge & output",
      sectionAdvanced: "Advanced",
      mode: "Continuation",
      modeContinuous: "Same camera",
      modeCloseup: "Cut to close-up",
      ratio: "Aspect ratio",
      generateAudio: "Generate audio",
      watermark: "Watermark",
      extraParams: "Extra params (JSON)",
      pollIntervalMs: "Poll interval (ms)",
      maxWaitMs: "Max wait (ms)",
      save: "Save",
      reset: "Reset plugin",
      saving: "Saving\u2026",
      saved: "Saved; the Host applies it after the config reload.",
      saveFailed: "The Host rejected this write; check the field values.",
      dirty: "Unsaved changes",
      loading: "Reading configuration\u2026",
      unavailable: "This Host does not serve this entry as an editable setting yet (namespace metaontic-video is not ready). If the row already exists in the profile cordis.patch.yml, restart Harness so the Host reloads it; if the message persists, the Host version and the plugin settings interface do not match.",
      readOnly: "This profile does not accept form writes."
    };
    const MODEL_OPTIONS = [
      "doubao-seedance-2-0-mini-260615",
      "doubao-seedance-2-0-fast-260128"
    ];
    const SELECTS = {
      model: MODEL_OPTIONS,
      mode: ["continuous", "closeup"],
      ratio: ["16:9", "9:16", "4:3", "3:4", "1:1", "adaptive"],
      mergeMode: ["seamless", "copy", "reencode"]
    };
    const SECTIONS = [
      { key: "sectionGeneration", fields: ["model", "mode", "ratio", "generateAudio", "watermark"] },
      { key: "sectionMerge", fields: ["mergeMode", "outputDir", "keepSegments"] },
      { key: "sectionAdvanced", fields: ["extraParams", "pollIntervalMs", "maxWaitMs", "ffmpegBinary", "ffprobeBinary"] }
    ];
    const FIELDS = [
      // 模型用下拉选（候选见 MODEL_OPTIONS），占一整行显示完整型号
      { key: "model", kind: "select", wide: true },
      { key: "mode", kind: "select" },
      { key: "ratio", kind: "select" },
      { key: "generateAudio", kind: "switch" },
      { key: "watermark", kind: "switch" },
      { key: "mergeMode", kind: "select" },
      { key: "outputDir", kind: "text" },
      { key: "keepSegments", kind: "switch" },
      { key: "extraParams", kind: "text" },
      { key: "pollIntervalMs", kind: "number" },
      { key: "maxWaitMs", kind: "number" },
      { key: "ffmpegBinary", kind: "text", mono: true },
      { key: "ffprobeBinary", kind: "text", mono: true }
    ];
    const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((field) => [field.key, field]));
    const DEFAULT_REGISTER_API = "https://video.mybfs.cn";
    const LOGGED_OUT_KEY = "metaontic-video.logged-out";
    const PLUGIN_OWNED_KEYS = [
      "apiKey",
      "keyOrigin",
      "baseUrl",
      "registerEmail",
      "deviceId",
      "deviceSecret",
      "model"
    ];
    const DEFAULT_REGISTER_TOKEN = "metaontic-video-register-v1";
    const UPDATE_PROJECT = "hackloop/metaontic-video";
    const UPDATE_FILE_API = `https://gitee.com/api/v5/repos/${UPDATE_PROJECT}/contents/package.json`;
    const UPDATE_COMMAND = 'dsh plugin --profile desktop remove metaontic-video && dsh plugin --profile desktop add "git+https://gitee.com/hackloop/metaontic-video.git"';
    const UPDATE_CACHE_KEY = "metaontic-video.update-check";
    const UPDATE_MAX_AGE_MS = 6 * 60 * 60 * 1e3;
    const PLUGIN_VERSION = true ? "2.7.2".trim().replace(/^v/i, "") : "";
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
    function isNewerVersion(remote, local) {
      const parse = (text) => {
        const match = /(\d+)\.(\d+)\.(\d+)/.exec(String(text || ""));
        return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
      };
      const next = parse(remote);
      const current = parse(local);
      if (!next || !current) return false;
      for (let index = 0; index < 3; index += 1) {
        if (next[index] !== current[index]) return next[index] > current[index];
      }
      return false;
    }
    function decodeBase64Text(raw) {
      if (typeof atob !== "function") return "";
      const binary = atob(String(raw || "").replace(/\s+/g, ""));
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return typeof TextDecoder === "function" ? new TextDecoder().decode(bytes) : binary;
    }
    async function fetchLatestVersion() {
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timer = controller ? window.setTimeout(() => controller.abort(), 12e3) : null;
      let response;
      try {
        response = await fetch(UPDATE_FILE_API, {
          headers: { accept: "application/json" },
          signal: controller ? controller.signal : void 0
        });
      } finally {
        if (timer) window.clearTimeout(timer);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      const text = body && typeof body.content === "string" ? decodeBase64Text(body.content) : "";
      if (!text) throw new Error("empty file");
      const version = String((JSON.parse(text) || {}).version || "").trim().replace(/^v/i, "");
      if (!version) throw new Error("no version");
      return version;
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
    const inputStyle = { width: "100%", boxSizing: "border-box" };
    const PAGE_CSS = `
      /* \u6574\u9875\u7EB5\u5411\u6392\u5E03\uFF1A\u5757\u4E0E\u5757\u4E4B\u95F4\u7EDF\u4E00 16px\uFF0C\u6BD4\u4E00\u6574\u7247\u8868\u5355\u597D\u626B */
      .mov-page { display: flex; flex-direction: column; gap: 16px; padding: 4px 0; color: ${TOKENS.text}; }
      /* \u5206\u7EC4\u5361\u7247\uFF1A16 \u4E2A\u5B57\u6BB5\u644A\u5728\u4E00\u683C\u91CC\u592A\u7CCA\uFF0C\u6309\u7528\u9014\u5404\u88C5\u4E00\u5F20\u5361 */
      .mov-section { display: flex; flex-direction: column; gap: 14px; padding: 14px 16px 16px; border-radius: 12px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.cardFill}; }
      .mov-section-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      /* \u6807\u9898\u5DE6\u8FB9\u4E00\u9053\u4E3B\u8272\u7AD6\u6761\uFF0C\u4EE3\u66FF\u7EAF\u6587\u5B57\u5206\u7EC4\u6807\u9898 */
      .mov-section-title::before { content: ""; flex: 0 0 auto; width: 3px; height: 13px; border-radius: 2px; background: ${TOKENS.primaryFill}; }
      .mov-section-title::after { content: ""; flex: 1 1 auto; height: 1px; background: ${TOKENS.border}; }
      /* \u4E24\u5217\u81EA\u9002\u5E94\uFF1A\u5355\u5217\u81F3\u5C11 240px\uFF0C\u7A84\u9762\u677F\u81EA\u52A8\u843D\u6210\u4E00\u5217 */
      .mov-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px 18px; }
      .mov-field { display: flex; flex-direction: column; min-width: 0; }
      /* \u5F00\u5173\u6CA1\u6709\u6807\u7B7E\u884C\uFF0C\u9760\u5E95\u5BF9\u9F50\u624D\u80FD\u8DDF\u65C1\u8FB9\u8F93\u5165\u6846\u7684\u63A7\u5236\u7EBF\u9F50\u5E73 */
      .mov-field-switch { justify-content: flex-end; }
      .mov-field-wide { grid-column: 1 / -1; }
      .mov-label { display: block; font-size: 12px; color: ${TOKENS.muted}; margin-bottom: 6px; }
      .mov-input { padding: 8px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.controlFill}; color: ${TOKENS.text}; font: inherit; font-size: 13px; height: 36px; }
      .mov-input:focus, .mov-input:focus-visible { outline: none; border-color: ${TOKENS.primaryFill}; box-shadow: 0 0 0 3px rgba(36, 123, 191, .18); }
      /* \u6A21\u578B ID \u4E0E\u53EF\u6267\u884C\u6587\u4EF6\u8DEF\u5F84\u5F88\u957F\uFF1A\u7B49\u5BBD\u5B57\u4F53 + \u7701\u7565\uFF0C\u4E0D\u628A\u6574\u884C\u6491\u53D8\u5F62 */
      .mov-mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 12.5px; }
      /* \u5F00\u5173\u505A\u6210\u8DDF\u8F93\u5165\u6846\u540C\u9AD8\u7684\u5C0F\u65B9\u5757\uFF0C\u548C\u5468\u56F4\u63A7\u4EF6\u4E00\u6761\u7EBF */
      .mov-switch { display: flex; align-items: center; gap: 8px; padding: 0 10px; height: 36px; box-sizing: border-box; border: 1px solid ${TOKENS.border}; border-radius: 8px; background: ${TOKENS.controlFill}; font-size: 13px; color: ${TOKENS.text}; cursor: pointer; }
      .mov-switch:hover { border-color: ${TOKENS.primaryFill}; }
      .mov-switch input { width: 15px; height: 15px; accent-color: ${TOKENS.primaryFill}; cursor: pointer; }
      .mov-card { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 12px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.cardFill}; }
      .mov-card-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .mov-card-title { font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-hint { font-size: 12px; color: ${TOKENS.muted}; line-height: 1.5; }
      .mov-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 7px 13px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: transparent; color: ${TOKENS.text}; font: inherit; font-size: 12.5px; line-height: 1.2; cursor: pointer; white-space: nowrap; transition: background .15s, border-color .15s, color .15s, opacity .15s; }
      .mov-btn:hover:not(:disabled) { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
      .mov-btn:disabled { opacity: .5; cursor: default; }
      .mov-btn-primary { border-color: ${TOKENS.primaryFill}; background: ${TOKENS.primaryFill}; color: #fff; font-weight: 600; }
      .mov-btn-primary:hover:not(:disabled) { color: #fff; opacity: .88; }
      .mov-btn-sm { min-height: 30px; padding: 5px 10px; border-radius: 7px; font-size: 12px; }
      .mov-trailing { margin-left: auto; }
      /* \u989D\u5EA6\uFF1A\u4E09\u4E2A\u6570\u5B57\u5757\uFF0C\u4E00\u773C\u5206\u6E05\u5269\u4F59 / \u5DF2\u7528 / \u603B\u989D\u5EA6 */
      .mov-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
      .mov-stat { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; border: 1px solid ${TOKENS.border}; }
      .mov-stat-label { font-size: 11.5px; color: ${TOKENS.muted}; }
      .mov-stat-value { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
      .mov-foot-note { font-size: 11.5px; color: ${TOKENS.muted}; }
      /* ffmpeg \u5B89\u88C5\u547D\u4EE4\uFF1A\u4E00\u884C\u7B49\u5BBD\u3001\u53EF\u590D\u5236\uFF0C\u4E0D\u7528\u6491\u6EE1\u6574\u884C */
      .mov-cmd-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .mov-tag { flex: 0 0 auto; min-width: 132px; font-size: 12px; color: ${TOKENS.muted}; }
      .mov-code { flex: 0 0 auto; max-width: 100%; padding: 6px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.controlFill}; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
      /* \u4F7F\u7528\u8BB0\u5F55\uFF1A\u6591\u9A6C\u7EB9 + \u7EC6\u8868\u5934\uFF0C\u6A21\u578B\u5217\u5403\u6389\u5269\u4F59\u5BBD\u5EA6 */
      /* \u9762\u677F\u5F88\u7A84\u65F6\u8868\u683C\u6A2A\u5411\u6EDA\u52A8\uFF0C\u4E5F\u4E0D\u628A\u300C\u65F6\u95F4\u300D\u6324\u6210\u4E24\u884C */
      .mov-table { display: flex; flex-direction: column; margin: 0 -6px; overflow-x: auto; }
      .mov-table-head, .mov-table-row { display: grid; grid-template-columns: 106px 78px minmax(72px, 1fr) 84px 60px; align-items: center; gap: 10px; padding: 8px 10px; }
      .mov-table-head > :nth-child(1), .mov-table-row > :nth-child(1) { white-space: nowrap; }
      .mov-table-head { font-size: 11px; letter-spacing: .03em; color: ${TOKENS.muted}; border-bottom: 1px solid ${TOKENS.border}; }
      .mov-table-row { font-size: 12.5px; border-radius: 8px; }
      .mov-table-row:nth-child(even) { background: rgba(127, 127, 127, .05); }
      .mov-table-row:hover { background: rgba(127, 127, 127, .1); }
      /* \u8D39\u7528\u4E0E\u7ED3\u679C\u4E24\u5217\u53F3\u5BF9\u9F50\uFF0C\u6570\u5B57\u7AD6\u7740\u5BF9\u5F97\u9F50 */
      .mov-table-head > :nth-child(4), .mov-table-row > :nth-child(4),
      .mov-table-head > :nth-child(5), .mov-table-row > :nth-child(5) { text-align: right; }
      .mov-model { min-width: 0; overflow: hidden; color: ${TOKENS.muted}; white-space: nowrap; text-overflow: ellipsis; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
      .mov-num { font-variant-numeric: tabular-nums; }
      /* \u7ED3\u679C\u7528\u80F6\u56CA\u6807\u7B7E\uFF0C\u6BD4\u88F8\u6587\u5B57\u66F4\u5BB9\u6613\u4E00\u773C\u626B\u5230 */
      .mov-chip { display: inline-flex; align-items: center; justify-content: center; padding: 1px 8px; border-radius: 999px; font-size: 11.5px; line-height: 1.7; }
      .mov-chip-ok { color: ${TOKENS.success}; background: rgba(46, 158, 91, .12); }
      .mov-chip-bad { color: ${TOKENS.error}; background: rgba(217, 83, 79, .12); }
      /* \u6CE8\u518C\u8868\u5355\uFF1A\u8F93\u5165\u6846\u5403\u6389\u591A\u4F59\u5BBD\u5EA6\uFF0C\u4E24\u4E2A\u6309\u94AE\u4E0D\u6362\u884C */
      .mov-register-form { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      /* \u5E95\u90E8\u64CD\u4F5C\u6761\uFF1A\u4E0A\u8FB9\u7EBF\u628A\u300C\u4FDD\u5B58\u300D\u548C\u914D\u7F6E\u5185\u5BB9\u5206\u5F00 */
      .mov-footer { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 2px 2px; border-top: 1px solid ${TOKENS.border}; }
      .mov-notice { margin: 0; font-size: 12px; color: ${TOKENS.muted}; line-height: 1.5; }
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
        const statusTimer = React.useRef(null);
        const [registerStatus, setRegisterStatus] = React.useState("idle");
        const [registerMessage, setRegisterMessage] = React.useState("");
        const [registerEmail, setRegisterEmail] = React.useState(() => {
          const saved = form.getSnapshot().value || {};
          return String(saved.registerEmail || "");
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
        const [updateStatus, setUpdateStatus] = React.useState("idle");
        const [updateMessage, setUpdateMessage] = React.useState("");
        const [updateLatest, setUpdateLatest] = React.useState("");
        const [updateAt, setUpdateAt] = React.useState("");
        const [copiedUpdate, setCopiedUpdate] = React.useState("");
        const restoreTried = React.useRef(false);
        React.useEffect(() => {
          if (restoreTried.current) return;
          restoreTried.current = true;
          const snap = form.getSnapshot() || {};
          if (loggedOut()) {
            setRegisterStatus("idle");
            return;
          }
          syncDeviceIdentity().catch(() => {
          });
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
        const updateTried = React.useRef(false);
        React.useEffect(() => {
          if (updateTried.current) return;
          updateTried.current = true;
          const cached = readUpdateCache();
          if (cached.latest) {
            setUpdateLatest(cached.latest);
            if (cached.at) setUpdateAt(new Date(cached.at).toLocaleTimeString());
            setUpdateStatus("ok");
          }
          if (!cached.fresh) checkForUpdate(true).catch(() => {
          });
        }, []);
        if (props && props.view === "summary") {
          const configured = Boolean(value.model) || Boolean(snapshot.secrets?.apiKey);
          const text = configured ? t("summary", { provider: t("providerNewapi"), model: value.model || "-" }) : t("summaryEmpty");
          return h("span", { style: { color: TOKENS.muted } }, text);
        }
        const pending = Object.entries(draft).filter(([key, next]) => !same(value[key], next));
        const edit = (key, next) => {
          clearStatusTimer();
          setStatus((current) => current === "idle" ? current : "idle");
          setDraft((current) => ({ ...current, [key]: next }));
        };
        const clear = (key) => setDraft((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        function clearStatusTimer() {
          if (statusTimer.current) {
            window.clearTimeout(statusTimer.current);
            statusTimer.current = null;
          }
        }
        function flashStatus(next, holdMs = 2500) {
          clearStatusTimer();
          setStatus(next);
          statusTimer.current = window.setTimeout(() => {
            statusTimer.current = null;
            setStatus("idle");
          }, holdMs);
        }
        async function save() {
          setStatus("saving");
          let ok = true;
          for (const [key, next] of pending) {
            const accepted = await form.set(key, next);
            if (accepted) clear(key);
            else ok = false;
          }
          if (ok) flashStatus("saved");
          else setStatus("failed");
        }
        async function reset() {
          const overridden = Object.keys(snapshot.user || {});
          if (!overridden.length && !keyReady) return;
          setStatus("saving");
          const targets = /* @__PURE__ */ new Set([...overridden, ...PLUGIN_OWNED_KEYS]);
          for (const key of targets) await form.unset(key);
          forgetDevice();
          setDraft({});
          setRegisterStatus("idle");
          setRegisterMessage("");
          setRegisterCode("");
          setStatus("idle");
        }
        function registerApiRoot() {
          const configured = String(value.registerApi || "").trim();
          return (configured || DEFAULT_REGISTER_API).replace(/\/+$/, "");
        }
        function loggedOut() {
          try {
            return window.localStorage.getItem(LOGGED_OUT_KEY) === "1";
          } catch {
            return false;
          }
        }
        function setLoggedOut() {
          try {
            window.localStorage.setItem(LOGGED_OUT_KEY, "1");
          } catch {
          }
        }
        function clearLoggedOut() {
          try {
            window.localStorage.removeItem(LOGGED_OUT_KEY);
          } catch {
          }
        }
        function forgetDevice() {
          try {
            window.localStorage.removeItem("metaontic-video.device-id");
            window.localStorage.removeItem("metaontic-video.device-secret");
          } catch {
          }
          setLoggedOut();
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
            // 本插件版本：服务端会记进请求日志，便于回溯「这版有没有问题」
            ...PLUGIN_VERSION ? { "x-plugin-version": PLUGIN_VERSION } : {},
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
          clearLoggedOut();
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
        function readUpdateCache() {
          try {
            const raw = window.localStorage.getItem(UPDATE_CACHE_KEY);
            const saved = raw ? JSON.parse(raw) : null;
            if (!saved || typeof saved !== "object") return { latest: "", at: 0, fresh: false };
            const at = Number(saved.at) || 0;
            return {
              latest: String(saved.latest || ""),
              at,
              fresh: Boolean(at) && Date.now() - at < UPDATE_MAX_AGE_MS
            };
          } catch {
            return { latest: "", at: 0, fresh: false };
          }
        }
        function rememberUpdateCheck(latest) {
          try {
            window.localStorage.setItem(UPDATE_CACHE_KEY, JSON.stringify({ at: Date.now(), latest }));
          } catch {
          }
        }
        async function checkForUpdate(silent = false) {
          if (!silent) {
            setUpdateStatus("working");
            setUpdateMessage("");
          }
          try {
            const latest = await fetchLatestVersion();
            setUpdateLatest(latest);
            setUpdateAt((/* @__PURE__ */ new Date()).toLocaleTimeString());
            setUpdateStatus("ok");
            rememberUpdateCheck(latest);
            return latest;
          } catch (error) {
            if (silent) return "";
            setUpdateStatus("failed");
            setUpdateMessage(t("versionFailed", { message: error?.message || String(error) }));
            return "";
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
            const options = SELECTS[field.key] || [];
            const list = current && !options.includes(current) ? [...options, current] : options;
            return h("select", {
              id,
              "data-field": field.key,
              className: `mov-input${field.mono ? " mov-mono" : ""}`,
              style: inputStyle,
              value: current ?? "",
              onChange: (event) => edit(field.key, event.target.value)
            }, list.map((option) => h("option", { key: option, value: option }, optionLabel(t, field.key, option))));
          }
          return h("input", {
            id,
            "data-field": field.key,
            className: `mov-input${field.mono ? " mov-mono" : ""}`,
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
        const hints = { model: t("modelHint") };
        function fieldCell(field) {
          const classes = ["mov-field"];
          if (field.kind === "switch") classes.push("mov-field-switch");
          if (field.wide) classes.push("mov-field-wide");
          return h("div", { key: field.key, className: classes.join(" ") }, [
            field.kind === "switch" ? null : h("label", { key: "label", className: "mov-label", htmlFor: `metaontic-video-${field.key}` }, t(field.key)),
            control(field),
            hints[field.key] ? h("span", { key: "hint", className: "mov-hint", style: { marginTop: 4 } }, hints[field.key]) : null
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
        const overrides = Object.keys(snapshot.user || {});
        const footerMessage = status === "saved" ? t("saved") : status === "failed" ? t("saveFailed") : pending.length ? t("dirty") : "";
        const footer = pending.length || overrides.length || status !== "idle" ? h("div", { key: "footer", className: "mov-footer" }, [
          pending.length ? h("button", {
            key: "save",
            "data-action": "save",
            type: "button",
            className: "mov-btn mov-btn-primary",
            disabled: status === "saving" || snapshot.writable === false,
            onClick: save
          }, status === "saving" ? t("saving") : t("save")) : null,
          overrides.length ? h("button", {
            key: "reset",
            "data-action": "reset",
            type: "button",
            className: "mov-btn",
            disabled: status === "saving",
            onClick: reset
          }, t("reset")) : null,
          footerMessage ? h("span", {
            key: "status",
            style: {
              fontSize: 12,
              color: status === "failed" ? TOKENS.error : status === "saved" ? TOKENS.success : TOKENS.muted
            }
          }, footerMessage) : null
        ]) : null;
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
        const quotaFallback = keyReady ? t("quotaLoading") : t("quotaNoKey");
        const quotaStats = quotaReady ? [
          {
            key: "remain",
            label: t("quotaRemain"),
            value: quota.unlimited_quota ? t("quotaUnlimited") : money("remain_amount"),
            color: TOKENS.success
          },
          { key: "used", label: t("quotaUsed"), value: money("used_amount"), color: TOKENS.text },
          { key: "total", label: t("quotaTotal"), value: money("total_amount"), color: TOKENS.muted }
        ] : null;
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
          h("span", { key: "body", className: "mov-hint" }, t("ffmpegBody")),
          h("span", { key: "for", className: "mov-hint" }, t("ffmpegInstallFor")),
          ...installRows.map((item, index) => h("div", {
            key: `install-${index}`,
            "data-field": "ffmpegInstall",
            className: "mov-cmd-row"
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
          h("span", { key: "after", className: "mov-hint" }, t("ffmpegAfter"))
        ]);
        const quotaBox = keyReady ? h("div", {
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
          quotaStats ? h(
            "div",
            { key: "text", "data-field": "quotaValue", className: "mov-stats" },
            quotaStats.map((item) => h("div", { key: item.key, className: "mov-stat" }, [
              h("span", { key: "label", className: "mov-stat-label" }, item.label),
              h("span", {
                key: "value",
                className: "mov-stat-value",
                style: { color: item.color }
              }, item.value)
            ]))
          ) : h("span", {
            key: "text",
            "data-field": "quotaValue",
            className: "mov-hint"
          }, quotaFallback),
          quotaReady ? h("span", { key: "at", className: "mov-foot-note" }, t("quotaUpdatedAt", { time: quotaAt })) : null,
          quotaMessage ? h("span", { key: "message", className: "mov-hint" }, quotaMessage) : null
        ]) : null;
        function copyText(text, mark) {
          try {
            const result = window.navigator?.clipboard?.writeText(text);
            if (result && typeof result.then === "function") {
              result.then(() => {
                mark(text);
                window.setTimeout(() => mark(""), 2e3);
              }, () => {
              });
            }
          } catch {
          }
        }
        function copyCommand(command) {
          copyText(command, setCopiedFfmpeg);
        }
        function copyUpdateCommand() {
          copyText(UPDATE_COMMAND, setCopiedUpdate);
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
              className: "mov-hint",
              style: { flex: "1 1 160px" }
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
              h(
                "span",
                { key: "status" },
                h("span", {
                  key: "chip",
                  className: `mov-chip ${row.status === "succeeded" ? "mov-chip-ok" : "mov-chip-bad"}`
                }, row.status === "succeeded" ? t("usageStatusOk") : t("usageStatusFailed"))
              )
            ]))
          ]) : null,
          usageMessage ? h("span", { key: "message", className: "mov-hint" }, usageMessage) : null
        ]) : null;
        const updateAvailable = Boolean(updateLatest) && Boolean(PLUGIN_VERSION) && isNewerVersion(updateLatest, PLUGIN_VERSION);
        const updateText = updateStatus === "working" ? t("versionChecking") : updateStatus === "failed" ? updateMessage : updateStatus === "ok" ? updateAvailable ? t("versionNew", { version: updateLatest }) : t("versionLatest") : "";
        const versionBox = h("div", {
          key: "version",
          "data-field": "version",
          className: "mov-card"
        }, [
          h("div", { key: "head", className: "mov-card-head" }, [
            h("span", { key: "title", className: "mov-card-title" }, t("versionTitle")),
            h("span", {
              key: "current",
              "data-field": "versionCurrent",
              className: "mov-hint",
              style: { flex: "1 1 120px" }
            }, PLUGIN_VERSION ? t("versionCurrent", { version: PLUGIN_VERSION }) : ""),
            h("button", {
              key: "check",
              "data-action": "update-check",
              type: "button",
              className: "mov-btn mov-btn-sm mov-trailing",
              disabled: updateStatus === "working",
              onClick: () => {
                checkForUpdate(false).catch(() => {
                });
              }
            }, updateStatus === "working" ? t("versionChecking") : t("versionCheck"))
          ]),
          updateText ? h("span", {
            key: "state",
            "data-field": "versionState",
            className: "mov-hint",
            style: {
              color: updateStatus === "failed" ? TOKENS.error : updateAvailable ? TOKENS.success : TOKENS.muted
            }
          }, updateText) : null,
          updateAvailable ? h("div", { key: "command", className: "mov-cmd-row" }, [
            h("code", {
              key: "code",
              "data-field": "updateCommand",
              className: "mov-code"
            }, UPDATE_COMMAND),
            h("button", {
              key: "copy",
              "data-action": "update-copy",
              type: "button",
              className: "mov-btn mov-btn-sm",
              onClick: copyUpdateCommand
            }, copiedUpdate ? t("versionCopied") : t("versionCopy"))
          ]) : null,
          updateAvailable ? h("span", { key: "hint", className: "mov-hint" }, t("versionHint")) : null,
          updateStatus === "ok" && updateAt ? h("span", { key: "at", className: "mov-foot-note" }, t("versionCheckedAt", { time: updateAt })) : null
        ]);
        const registerBox = keyReady ? null : h("div", {
          key: "register",
          className: "mov-card",
          style: { gap: 10 }
        }, [
          h("div", { key: "text", style: { display: "flex", flexDirection: "column", gap: 4 } }, [
            h(
              "span",
              { key: "title", className: "mov-card-title" },
              t("registerTitle")
            ),
            h("span", { key: "hint", className: "mov-hint" }, t("registerHint"))
          ]),
          h("div", { key: "form", className: "mov-register-form" }, [
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
                flex: "1 1 220px",
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
              style: { ...inputStyle, flex: "0 1 130px", width: "auto" }
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
        const blobs = notice && !snapshot.value ? [] : [ffmpegBox, registerBox, quotaBox, usageBox, versionBox, footer];
        return h("div", { className: "mov-page" }, [
          // hover / focus 这类效果内联样式写不出来，集中在这张样式表里（class 都带 mov- 前缀）。
          h("style", { key: "styles" }, PAGE_CSS),
          notice ? h("p", { key: "notice", className: "mov-notice" }, notice) : null,
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
