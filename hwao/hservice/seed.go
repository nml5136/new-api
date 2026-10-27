package hservice

import "github.com/QuantumNous/new-api/hwao/hmodel"

// SeedDefaults 写入预置场景 SC01–SC03（草稿版本，候选模型需运营在上架模型后补充并评测发布）。
// 按场景 ID 幂等，已存在则跳过；与 sql/mysql/hwao_router.sql 种子数据一致。
func SeedDefaults() {
	seeds := []struct{ id, name, desc, format string }{
		{"SC01", "通用问答", "日常问答、写作与摘要", "text"},
		{"SC02", "代码助手", "代码生成、解释与审查", "text"},
		{"SC03", "结构化抽取", "按 JSON 模板抽取字段", "json"},
	}
	for _, s := range seeds {
		var n int64
		DB().Model(&hmodel.Scene{}).Where("scene_id = ?", s.id).Count(&n)
		if n > 0 {
			continue
		}
		DB().Create(&hmodel.Scene{SceneId: s.id, Name: s.name, Description: s.desc, Status: hmodel.SceneDraft})
		DB().Create(&hmodel.SceneVersion{SceneId: s.id, Version: 1, OutputFormat: s.format, MinQuality: 1,
			DefaultMaxCost: 100, DefaultMaxTokens: 2048, Status: hmodel.SceneDraft, ChangeReason: "初始化种子"})
	}
}
