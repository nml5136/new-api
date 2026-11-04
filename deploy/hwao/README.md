# hwao router 生产部署（Docker Compose）

三个容器：`hwao-mariadb`、`hwao-redis`、`hwao-app`。仅 app 对外暴露 **38000**（容器内 3000），数据库与 Redis 只在 compose 内网。

## 服务器目录约定
| 路径 | 说明 |
|---|---|
| `/app/docker-compose.yml` | 本目录的 docker-compose.yml |
| `/app/conf/app.env` | 应用环境变量（SQL_DSN、REDIS_CONN_STRING、SESSION_SECRET、CRYPTO_SECRET、HWAO_SECRET），权限 600 |
| `/app/conf/db.env` | MariaDB 账号密码，权限 600 |
| `/app/conf/redis.pass` | Redis 密码，权限 600 |
| `/app/data/mysql` | MariaDB 数据 |
| `/app/data/redis` | Redis AOF 数据 |
| `/app/data/app` | 应用日志（logs/）等 |
| `/app/src` | 构建用源码 |

密钥用 `openssl rand -hex` 随机生成，**不入库**；`SESSION_SECRET`/`CRYPTO_SECRET`/`HWAO_SECRET` 生成后不要再改（会导致登录失效、已加密数据无法解密）。

## 首次部署
```bash
# 1. 上传源码到 /app/src 并构建镜像（国内默认走 npmmirror / goproxy.cn）
cd /app/src && docker build -f Dockerfile.hwao -t hwao-router:latest .
# 2. 生成 /app/conf 下三个配置文件（见上表），chmod 600
# 3. 启动
cd /app && docker compose up -d && docker compose ps
```
表结构：New API 表与 hwao_ 表均在应用启动时 GORM AutoMigrate 自动创建；`sql/mysql/hwao_router.sql` 供 DBA 审核/手工初始化。
首次启动 New API 自动创建 `root` 管理员（默认密码 123456），**必须立即修改**。

## 升级
```bash
cd /app/src && <更新源码> && docker build -f Dockerfile.hwao -t hwao-router:latest .
cd /app && docker compose up -d app
```

## 备份
```bash
docker exec hwao-mariadb sh -c 'mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction hwao_newapi' | gzip > /app/backup-$(date +%F).sql.gz
```

## 上线后需在运营后台配置
- 系统设置 → 服务器地址：`http://<公网IP或域名>:38000`（支付回调/跳转依赖它）
- 支付网关（易支付商户号/密钥）、模型渠道密钥：生产环境未预置，需运营填写
- 云安全组放行 TCP 38000
