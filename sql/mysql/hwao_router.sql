-- =====================================================================
-- hwao router 平台业务库脚本（MySQL 8 / MariaDB 10.6+，utf8mb4）
-- 与 New API 共用同一数据库；表名统一前缀 hwao_，不改动 New API 自有表。
-- 程序启动时也会通过 GORM AutoMigrate 自动建表，本脚本用于 DBA 审核与手工初始化。
-- 金额单位：人民币“分”；时间：Unix 秒；所有表含中文业务注释见 hwao/hmodel/models.go。
-- 生成方式：基于 AutoMigrate 结果导出（mysqldump --no-data），修改模型后请重新生成。
-- =====================================================================
SET NAMES utf8mb4;
/*M!999999\- enable the sandbox mode */ 

/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;
CREATE TABLE IF NOT EXISTS `hwao_alert` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `kind` varchar(32) DEFAULT NULL,
  `level` varchar(8) DEFAULT NULL,
  `tenant_id` bigint(20) DEFAULT NULL,
  `dedup_key` varchar(128) DEFAULT NULL,
  `scope` varchar(255) DEFAULT NULL,
  `message` varchar(512) DEFAULT NULL,
  `owner` bigint(20) DEFAULT NULL,
  `status` varchar(16) DEFAULT NULL,
  `resolution` varchar(512) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  `updated_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_hwao_alert_dedup_key` (`dedup_key`),
  KEY `idx_hwao_alert_kind` (`kind`),
  KEY `idx_hwao_alert_tenant_id` (`tenant_id`),
  KEY `idx_hwao_alert_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_attempt` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `attempt_id` varchar(64) DEFAULT NULL,
  `request_id` varchar(64) DEFAULT NULL,
  `model_name` varchar(128) DEFAULT NULL,
  `channel_id` bigint(20) DEFAULT NULL,
  `http_status` bigint(20) DEFAULT NULL,
  `status` varchar(16) DEFAULT NULL,
  `newapi_log_id` bigint(20) DEFAULT NULL,
  `quota` bigint(20) DEFAULT NULL,
  `error_message` varchar(512) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  `finished_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_hwao_attempt_attempt_id` (`attempt_id`),
  KEY `idx_hwao_attempt_request_id` (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_audit_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) DEFAULT NULL,
  `tenant_id` bigint(20) DEFAULT NULL,
  `action` varchar(64) DEFAULT NULL,
  `target` varchar(128) DEFAULT NULL,
  `detail` text DEFAULT NULL,
  `ip` varchar(64) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_hwao_audit_log_user_id` (`user_id`),
  KEY `idx_hwao_audit_log_tenant_id` (`tenant_id`),
  KEY `idx_hwao_audit_log_action` (`action`),
  KEY `idx_hwao_audit_log_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_budget_counter` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `scope` varchar(32) DEFAULT NULL,
  `period` varchar(16) DEFAULT NULL,
  `used` bigint(20) DEFAULT NULL,
  `reserved` bigint(20) DEFAULT NULL,
  `inflight` bigint(20) DEFAULT NULL,
  `alerted_level` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_budget` (`scope`,`period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_eval_result` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `scene_id` varchar(32) DEFAULT NULL,
  `model_name` varchar(128) DEFAULT NULL,
  `sample_size` bigint(20) DEFAULT NULL,
  `pass_rate` double DEFAULT NULL,
  `cost_per_qualified` bigint(20) DEFAULT NULL,
  `is_baseline` tinyint(1) DEFAULT NULL,
  `remark` varchar(255) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_hwao_eval_result_scene_id` (`scene_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_feedback` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `request_id` varchar(64) DEFAULT NULL,
  `tenant_id` bigint(20) DEFAULT NULL,
  `user_id` bigint(20) DEFAULT NULL,
  `scene_id` varchar(32) DEFAULT NULL,
  `satisfaction` bigint(20) DEFAULT NULL,
  `correct` tinyint(1) DEFAULT NULL,
  `switch_willing` tinyint(1) DEFAULT NULL,
  `reject_reason` varchar(16) DEFAULT NULL,
  `comment` varchar(512) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_hwao_feedback_request_id` (`request_id`),
  KEY `idx_hwao_feedback_tenant_id` (`tenant_id`),
  KEY `idx_hwao_feedback_scene_id` (`scene_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_idempotency` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) DEFAULT NULL,
  `api` varchar(64) DEFAULT NULL,
  `idem_key` varchar(128) DEFAULT NULL,
  `request_hash` char(64) DEFAULT NULL,
  `request_id` varchar(64) DEFAULT NULL,
  `status` varchar(16) DEFAULT NULL,
  `http_status` bigint(20) DEFAULT NULL,
  `response` mediumtext DEFAULT NULL,
  `expires_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_idem` (`tenant_id`,`api`,`idem_key`),
  KEY `idx_hwao_idempotency_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_invite` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `code` varchar(32) DEFAULT NULL,
  `remark` varchar(255) DEFAULT NULL,
  `used_by` bigint(20) DEFAULT NULL,
  `tenant_id` bigint(20) DEFAULT NULL,
  `expires_at` bigint(20) DEFAULT NULL,
  `created_by` bigint(20) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_hwao_invite_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_invoice` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) DEFAULT NULL,
  `title` varchar(128) DEFAULT NULL,
  `tax_no` varchar(64) DEFAULT NULL,
  `amount` bigint(20) DEFAULT NULL,
  `status` varchar(16) DEFAULT NULL,
  `delivery` varchar(255) DEFAULT NULL,
  `apply_by` bigint(20) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  `updated_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_hwao_invoice_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_ledger` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `biz_no` varchar(96) DEFAULT NULL,
  `tenant_id` bigint(20) DEFAULT NULL,
  `kind` varchar(16) DEFAULT NULL,
  `quota` bigint(20) DEFAULT NULL,
  `amount` bigint(20) DEFAULT NULL,
  `remark` varchar(255) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_hwao_ledger_biz_no` (`biz_no`),
  KEY `idx_hwao_ledger_created_at` (`created_at`),
  KEY `idx_hwao_ledger_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_member` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) DEFAULT NULL,
  `user_id` bigint(20) DEFAULT NULL,
  `role` varchar(32) DEFAULT NULL,
  `status` bigint(20) DEFAULT 1,
  `created_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member` (`tenant_id`,`user_id`),
  KEY `idx_hwao_member_tenant_id` (`tenant_id`),
  KEY `idx_hwao_member_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_model` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `model_name` varchar(128) DEFAULT NULL,
  `vendor` varchar(64) DEFAULT NULL,
  `display_name` varchar(128) DEFAULT NULL,
  `context_length` bigint(20) DEFAULT NULL,
  `max_output` bigint(20) DEFAULT NULL,
  `support_json` tinyint(1) DEFAULT NULL,
  `support_stream` tinyint(1) DEFAULT NULL,
  `quality_level` bigint(20) DEFAULT NULL,
  `avg_latency_ms` bigint(20) DEFAULT NULL,
  `stability` bigint(20) DEFAULT NULL,
  `license_file` varchar(255) DEFAULT NULL,
  `license_expire_at` bigint(20) DEFAULT NULL,
  `status` varchar(16) DEFAULT NULL,
  `capability_version` bigint(20) DEFAULT 1,
  `created_at` bigint(20) DEFAULT NULL,
  `updated_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_hwao_model_model_name` (`model_name`),
  KEY `idx_hwao_model_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_platform_key` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  `owner_user_id` bigint(20) DEFAULT NULL,
  `name` varchar(64) DEFAULT NULL,
  `prefix` varchar(16) DEFAULT NULL,
  `digest` char(64) DEFAULT NULL,
  `internal_token_id` bigint(20) DEFAULT NULL,
  `internal_key_enc` text DEFAULT NULL,
  `status` bigint(20) DEFAULT 1,
  `expires_at` bigint(20) DEFAULT NULL,
  `grace_until` bigint(20) DEFAULT NULL,
  `quota_limit` bigint(20) DEFAULT NULL,
  `used_amount` bigint(20) DEFAULT NULL,
  `allow_ips` varchar(512) DEFAULT NULL,
  `last_used_at` bigint(20) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_hwao_platform_key_digest` (`digest`),
  KEY `idx_hwao_platform_key_tenant_id` (`tenant_id`),
  KEY `idx_hwao_platform_key_project_id` (`project_id`),
  KEY `idx_hwao_platform_key_owner_user_id` (`owner_user_id`),
  KEY `idx_hwao_platform_key_internal_token_id` (`internal_token_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_price_version` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `model_name` varchar(128) DEFAULT NULL,
  `version` bigint(20) DEFAULT NULL,
  `input_price` bigint(20) DEFAULT NULL,
  `output_price` bigint(20) DEFAULT NULL,
  `cache_read_price` bigint(20) DEFAULT NULL,
  `cache_write_price` bigint(20) DEFAULT NULL,
  `cost_input_price` bigint(20) DEFAULT NULL,
  `cost_output_price` bigint(20) DEFAULT NULL,
  `tax_included` tinyint(1) DEFAULT 1,
  `tenant_id` bigint(20) DEFAULT NULL,
  `effective_at` bigint(20) DEFAULT NULL,
  `sync_status` varchar(16) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_by` bigint(20) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_hwao_price_version_model_name` (`model_name`),
  KEY `idx_hwao_price_version_effective_at` (`effective_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_project` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) DEFAULT NULL,
  `name` varchar(128) DEFAULT NULL,
  `is_default` tinyint(1) DEFAULT NULL,
  `scene_whitelist` text DEFAULT NULL,
  `model_whitelist` text DEFAULT NULL,
  `daily_budget` bigint(20) DEFAULT NULL,
  `monthly_budget` bigint(20) DEFAULT NULL,
  `max_cost_per_call` bigint(20) DEFAULT NULL,
  `max_concurrency` bigint(20) DEFAULT 5,
  `default_route_mode` varchar(16) DEFAULT 'scene',
  `preference` varchar(16) DEFAULT 'balanced',
  `allow_cross_model_fallback` tinyint(1) DEFAULT NULL,
  `status` bigint(20) DEFAULT 1,
  `created_at` bigint(20) DEFAULT NULL,
  `updated_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_hwao_project_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_project_member` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `project_id` bigint(20) DEFAULT NULL,
  `user_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_pm` (`project_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_recharge_order` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `order_no` varchar(64) DEFAULT NULL,
  `tenant_id` bigint(20) DEFAULT NULL,
  `amount` bigint(20) DEFAULT NULL,
  `quota` bigint(20) DEFAULT NULL,
  `kind` varchar(16) DEFAULT NULL,
  `pay_channel` varchar(32) DEFAULT NULL,
  `trade_no` varchar(128) DEFAULT NULL,
  `status` varchar(16) DEFAULT NULL,
  `voucher` varchar(255) DEFAULT NULL,
  `approved_by` bigint(20) DEFAULT NULL,
  `created_by` bigint(20) DEFAULT NULL,
  `credited_at` bigint(20) DEFAULT NULL,
  `refunded_amount` bigint(20) DEFAULT NULL,
  `remark` varchar(255) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_hwao_recharge_order_order_no` (`order_no`),
  KEY `idx_hwao_recharge_order_tenant_id` (`tenant_id`),
  KEY `idx_hwao_recharge_order_trade_no` (`trade_no`),
  KEY `idx_hwao_recharge_order_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_recon_diff` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `batch_no` varchar(32) DEFAULT NULL,
  `kind` varchar(32) DEFAULT NULL,
  `ref_no` varchar(96) DEFAULT NULL,
  `diff_key` varchar(32) DEFAULT NULL,
  `expected` bigint(20) DEFAULT NULL,
  `actual` bigint(20) DEFAULT NULL,
  `detail` varchar(512) DEFAULT NULL,
  `status` varchar(16) DEFAULT NULL,
  `handler` bigint(20) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_diff` (`diff_key`,`ref_no`),
  KEY `idx_hwao_recon_diff_batch_no` (`batch_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_refund` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `refund_no` varchar(64) DEFAULT NULL,
  `tenant_id` bigint(20) DEFAULT NULL,
  `kind` varchar(16) DEFAULT NULL,
  `order_no` varchar(64) DEFAULT NULL,
  `request_id` varchar(64) DEFAULT NULL,
  `amount` bigint(20) DEFAULT NULL,
  `quota` bigint(20) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `status` varchar(16) DEFAULT NULL,
  `external_no` varchar(128) DEFAULT NULL,
  `apply_by` bigint(20) DEFAULT NULL,
  `review_by` bigint(20) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  `updated_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_hwao_refund_refund_no` (`refund_no`),
  KEY `idx_hwao_refund_tenant_id` (`tenant_id`),
  KEY `idx_hwao_refund_order_no` (`order_no`),
  KEY `idx_hwao_refund_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_request` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `request_id` varchar(64) DEFAULT NULL,
  `tenant_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  `key_id` bigint(20) DEFAULT NULL,
  `user_id` bigint(20) DEFAULT NULL,
  `source` varchar(8) DEFAULT NULL,
  `scene_id` varchar(32) DEFAULT NULL,
  `scene_version_id` bigint(20) DEFAULT NULL,
  `route_mode` varchar(16) DEFAULT NULL,
  `preference` varchar(16) DEFAULT NULL,
  `session_id` varchar(64) DEFAULT NULL,
  `requested_model` varchar(128) DEFAULT NULL,
  `actual_model` varchar(128) DEFAULT NULL,
  `price_version_id` bigint(20) DEFAULT NULL,
  `policy_version` varchar(32) DEFAULT NULL,
  `route_reason` text DEFAULT NULL,
  `is_stream` tinyint(1) DEFAULT NULL,
  `max_cost` bigint(20) DEFAULT NULL,
  `estimated_cost` bigint(20) DEFAULT NULL,
  `reserved_amount` bigint(20) DEFAULT NULL,
  `prompt_tokens` bigint(20) DEFAULT NULL,
  `completion_tokens` bigint(20) DEFAULT NULL,
  `cache_tokens` bigint(20) DEFAULT NULL,
  `newapi_quota` bigint(20) DEFAULT NULL,
  `net_cost` bigint(20) DEFAULT NULL,
  `purchase_cost` bigint(20) DEFAULT NULL,
  `status` varchar(16) DEFAULT NULL,
  `billing_status` varchar(16) DEFAULT NULL,
  `error_code` varchar(64) DEFAULT NULL,
  `error_message` varchar(512) DEFAULT NULL,
  `fallback` tinyint(1) DEFAULT NULL,
  `fallback_reason` varchar(255) DEFAULT NULL,
  `first_byte_ms` bigint(20) DEFAULT NULL,
  `latency_ms` bigint(20) DEFAULT NULL,
  `idempotency_key` varchar(128) DEFAULT NULL,
  `settle_retries` bigint(20) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  `finished_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_hwao_request_request_id` (`request_id`),
  KEY `idx_hwao_request_tenant_id` (`tenant_id`),
  KEY `idx_hwao_request_scene_id` (`scene_id`),
  KEY `idx_hwao_request_created_at` (`created_at`),
  KEY `idx_hwao_request_project_id` (`project_id`),
  KEY `idx_hwao_request_key_id` (`key_id`),
  KEY `idx_hwao_request_session_id` (`session_id`),
  KEY `idx_hwao_request_actual_model` (`actual_model`),
  KEY `idx_hwao_request_status` (`status`),
  KEY `idx_hwao_request_billing_status` (`billing_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_reservation` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `reserve_no` varchar(64) DEFAULT NULL,
  `request_id` varchar(64) DEFAULT NULL,
  `scopes` varchar(255) DEFAULT NULL,
  `amount` bigint(20) DEFAULT NULL,
  `status` varchar(16) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_hwao_reservation_reserve_no` (`reserve_no`),
  KEY `idx_hwao_reservation_request_id` (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_scene` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `scene_id` varchar(32) DEFAULT NULL,
  `name` varchar(64) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(16) DEFAULT NULL,
  `current_version_id` bigint(20) DEFAULT NULL,
  `prev_version_id` bigint(20) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  `updated_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_hwao_scene_scene_id` (`scene_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_scene_version` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `scene_id` varchar(32) DEFAULT NULL,
  `version` bigint(20) DEFAULT NULL,
  `scope` varchar(255) DEFAULT NULL,
  `system_prompt` text DEFAULT NULL,
  `input_template` text DEFAULT NULL,
  `output_format` varchar(16) DEFAULT NULL,
  `min_quality` bigint(20) DEFAULT NULL,
  `min_context` bigint(20) DEFAULT NULL,
  `candidates` text DEFAULT NULL,
  `default_max_cost` bigint(20) DEFAULT NULL,
  `default_max_tokens` bigint(20) DEFAULT NULL,
  `has_fallback` tinyint(1) DEFAULT NULL,
  `status` varchar(16) DEFAULT NULL,
  `change_reason` varchar(255) DEFAULT NULL,
  `rollout_tenants` text DEFAULT NULL,
  `created_by` bigint(20) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_hwao_scene_version_scene_id` (`scene_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_session` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `session_id` varchar(64) DEFAULT NULL,
  `tenant_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  `user_id` bigint(20) DEFAULT NULL,
  `scene_id` varchar(32) DEFAULT NULL,
  `scene_version_id` bigint(20) DEFAULT NULL,
  `model_name` varchar(128) DEFAULT NULL,
  `capability_version` bigint(20) DEFAULT NULL,
  `budget` bigint(20) DEFAULT NULL,
  `allow_switch` tinyint(1) DEFAULT NULL,
  `title` varchar(128) DEFAULT NULL,
  `source` varchar(8) DEFAULT NULL,
  `deleted` tinyint(1) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  `updated_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_hwao_session_session_id` (`session_id`),
  KEY `idx_hwao_session_tenant_id` (`tenant_id`),
  KEY `idx_hwao_session_project_id` (`project_id`),
  KEY `idx_hwao_session_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_session_message` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `session_id` varchar(64) DEFAULT NULL,
  `request_id` varchar(64) DEFAULT NULL,
  `role` varchar(16) DEFAULT NULL,
  `content` mediumtext DEFAULT NULL,
  `model_name` varchar(128) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_hwao_session_message_session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_staff` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) DEFAULT NULL,
  `role` varchar(32) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_staff` (`user_id`,`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_sync_cursor` (
  `name` varchar(32) NOT NULL,
  `position` bigint(20) DEFAULT NULL,
  `updated_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_tenant` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `name` varchar(128) NOT NULL,
  `provision_no` varchar(64) DEFAULT NULL,
  `status` varchar(16) DEFAULT NULL,
  `newapi_user_id` bigint(20) DEFAULT NULL,
  `fail_reason` varchar(255) DEFAULT NULL,
  `agreed_terms_at` bigint(20) DEFAULT NULL,
  `daily_budget` bigint(20) DEFAULT NULL,
  `monthly_budget` bigint(20) DEFAULT NULL,
  `max_concurrency` bigint(20) DEFAULT 10,
  `alert_thresholds` varchar(64) DEFAULT '80,95',
  `created_at` bigint(20) DEFAULT NULL,
  `updated_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_hwao_tenant_provision_no` (`provision_no`),
  KEY `idx_hwao_tenant_status` (`status`),
  KEY `idx_hwao_tenant_newapi_user_id` (`newapi_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_ticket` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint(20) DEFAULT NULL,
  `request_id` varchar(64) DEFAULT NULL,
  `order_no` varchar(64) DEFAULT NULL,
  `subject` varchar(255) DEFAULT NULL,
  `action` varchar(32) DEFAULT NULL,
  `liability` varchar(32) DEFAULT NULL,
  `status` varchar(16) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `handler` bigint(20) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  `updated_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_hwao_ticket_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;


-- ===================== 种子数据 =====================
-- 预置场景（草稿；运营上架模型、补候选并评测通过后发布）
INSERT IGNORE INTO hwao_scene (scene_id,name,description,status,current_version_id,prev_version_id,created_at,updated_at) VALUES
 ('SC01','电商文案','根据商品资料生成合规的电商描述文案','draft',0,0,UNIX_TIMESTAMP(),UNIX_TIMESTAMP()),
 ('SC02','办公摘要','长文档/会议记录要点摘要，保留关键数字','draft',0,0,UNIX_TIMESTAMP(),UNIX_TIMESTAMP()),
 ('SC03','结构化提取','按字段模板从文本中抽取结构化 JSON','draft',0,0,UNIX_TIMESTAMP(),UNIX_TIMESTAMP());
INSERT INTO hwao_scene_version (scene_id,version,output_format,min_quality,default_max_cost,default_max_tokens,has_fallback,status,change_reason,created_by,created_at)
SELECT s.scene_id,1,IF(s.scene_id='SC03','json','text'),1,100,2048,0,'draft','初始化种子',0,UNIX_TIMESTAMP()
FROM hwao_scene s WHERE NOT EXISTS (SELECT 1 FROM hwao_scene_version v WHERE v.scene_id=s.scene_id);
-- 角色：企业侧 tenant_admin（管理员）/ member（成员）存于 hwao_member.role；
-- 平台侧一期以 New API 管理员（role>=10）作为运营+财务，细分岗位见 hwao_staff（待确认）。

-- 网页自由对话（删除对话仅删正文，调用与账务记录保留；正文默认保留 180 天）
CREATE TABLE IF NOT EXISTS `hwao_conversation` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `conv_id` varchar(64) DEFAULT NULL,
  `tenant_id` bigint(20) DEFAULT NULL,
  `project_id` bigint(20) DEFAULT NULL,
  `user_id` bigint(20) DEFAULT NULL,
  `title` varchar(128) DEFAULT NULL,
  `model` varchar(128) DEFAULT NULL,
  `route_mode` varchar(16) DEFAULT NULL,
  `session_id` varchar(64) DEFAULT NULL,
  `deleted` tinyint(1) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  `updated_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_hwao_conversation_conv_id` (`conv_id`),
  KEY `idx_hwao_conversation_tenant_id` (`tenant_id`),
  KEY `idx_hwao_conversation_project_id` (`project_id`),
  KEY `idx_hwao_conversation_user_id` (`user_id`),
  KEY `idx_hwao_conversation_deleted` (`deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `hwao_conversation_message` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `conv_id` varchar(64) DEFAULT NULL,
  `role` varchar(16) DEFAULT NULL,
  `content` mediumtext DEFAULT NULL,
  `request_id` varchar(64) DEFAULT NULL,
  `status` varchar(16) DEFAULT NULL,
  `error_code` varchar(64) DEFAULT NULL,
  `error_message` varchar(512) DEFAULT NULL,
  `created_at` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_hwao_conversation_message_conv_id` (`conv_id`),
  KEY `idx_hwao_conversation_message_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
