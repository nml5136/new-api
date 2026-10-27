package hservice

import "github.com/QuantumNous/new-api/hwao/hmodel"

// SeedDefaults 写入预置场景 SC01–SC03（草稿版本，候选模型需运营在上架模型后补充并评测发布）。
// 按场景 ID 幂等，已存在则跳过；与 sql/mysql/hwao_router.sql 种子数据一致。
func SeedDefaults() {
	seeds := []struct{ id, name, desc, format string }{
		{"SC01", "电商文案", "根据商品资料生成合规的电商描述文案", "text"},
		{"SC02", "办公摘要", "长文档/会议记录要点摘要，保留关键数字", "text"},
		{"SC03", "结构化提取", "按字段模板从文本中抽取结构化 JSON", "json"},
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
