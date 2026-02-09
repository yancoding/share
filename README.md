# Video Share (Nuxt + MinIO)

无需登录即可上传视频，上传成功后会生成分享链接。分享链接格式为：

`/preview?video=<视频地址>`

## 功能说明

- 用户无需登录
- 无数据库，视频地址不落库
- 上传目标为 MinIO (S3 兼容)
- 分享地址由预览路由 + 查询字符串拼接

## 1. 安装依赖

```bash
npm install
```

## 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填写 MinIO 信息：

```bash
cp .env.example .env
```

环境变量说明：

- `MINIO_ENDPOINT`: MinIO 服务地址（例如 `http://127.0.0.1:9000`）
- `MINIO_PUBLIC_BASE_URL`: 分享视频地址使用的公网前缀（可选，不填则使用 `MINIO_ENDPOINT`）
- `MINIO_UPLOAD_URL_EXPIRES`: 预签名上传地址有效期（秒），默认 `3600`
- `MINIO_REGION`: S3 Region，默认 `us-east-1`
- `MINIO_ACCESS_KEY`: MinIO Access Key
- `MINIO_SECRET_KEY`: MinIO Secret Key
- `MINIO_BUCKET`: 存储桶名称
- `NUXT_PUBLIC_APP_BASE_URL`: 前端对外地址（生成分享链接时使用）

## 3. 运行

```bash
npm run dev
```

打开 `http://localhost:3000`。

## 4. MinIO 配置要求

- 桶需要允许读（至少允许通过对象 URL 访问视频）
- 上传默认使用浏览器直传 MinIO（通过预签名 URL），请在 MinIO 侧允许对应来源的 `PUT`/`HEAD`/`GET` CORS

## 路由

- 上传页：`/`
- 预览页：`/preview?video=<encodeURIComponent(视频地址)>`
