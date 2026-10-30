# 项目模板

## `brief.md`

```markdown
# <项目名>

- 一句话创意：
- 成片时长：15s
- 画幅：9:16
- 平台：抖音 / 视频号 / 小红书
- 风格：真实生活纪录感 / 轻喜剧 / 口播带货 / ……
- 受众：
- 必须出现：
- 不能出现：
- 声音：中文同期声，需要/不需要 BGM
- 字幕：需要/不需要
- 交付：720p（要更精细再 1080p）
```

## `script.md`

```markdown
---
status: draft            # draft | reviewed（脚本审核通过）| approved（制作确认后）
reviewed_at:             # 脚本审核通过后填本地时间
reviewed_by: user
approved_at:             # 用户确认制作后填本地时间
approved_by: user
---

# 脚本

## 一句话钩子


## 规格

- 时长：15s
- 画幅：9:16
- 平台：
- 风格：
- 声音：
- 字幕：

## 画面风格

- 色调：
- 光线：
- 质感 / 参考片感：

## 人物形象

- 人物 A：年龄 / 脸型 / 发型 / 服装 / 体型 / 气质
- 人物 B：

## 分镜表

| 镜头 | 时间 | 景别 | 画面 | 台词（有对白就写全） | 声音 |
| --- | --- | --- | --- | --- | --- |
| 1 | 0:00–0:07 | 中景 |  |  |  |
| 2 | 0:07–0:15 | 近景 |  |  |  |

## 完整台词

<!-- 无对白就写「本片无对白」；有对白按「秒 + 谁 + 说什么」逐句写 -->

## 结尾


## 每镜复述（人物形象 / 场景 / 光线）

- 人物 A：
- 人物 B：
- 场景：
- 光线：
```

两道关的顺序是：先把 `status` 从 `draft` 改成 `reviewed`（用户审核通过），用户确认制作后再改成 `approved`。
脚本任何改动都要改回 `draft`，重新审核、重新确认制作。

## `shots.json`

```json
{
  "project": "two-grandpas",
  "script": {
    "file": "script.md",
    "status": "approved",
    "approved_at": "2026-10-27T22:40:00+08:00"
  },
  "spec": {
    "duration": 15,
    "ratio": "9:16",
    "resolution": "720p",
    "audio": true,
    "mode": "continuous"
  },
  "shots": [
    {
      "id": "01",
      "seconds": 15,
      "shot_size": "中景转近景",
      "cast": ["李大爷", "王大爷", "采访者"],
      "dialogue": [
        {"at": "0:02", "speaker": "采访者", "line": "大爷，您家几个儿子啊？"},
        {"at": "0:04", "speaker": "李大爷", "line": "仨。"}
      ],
      "prompt_file": "prompts/01-two-grandpas.txt",
      "task_id": null,
      "clip_path": null,
      "status": "prompted"
    }
  ]
}
```

`status` 取值：`draft` → `prompted` → `generating` → `generated` → `accepted` / `rejected`。
多镜时每镜一条；重生成只改对应镜头。
