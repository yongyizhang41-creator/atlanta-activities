> 2026-10-22 更新：后台地理编码已改为 Nominatim，无需第二个 MapTiler key 或付费升级。保留现有 Web key 的 localhost 限制。下文涉及创建后端 MapTiler key 的步骤已被替代，不要执行。公共服务只用于低流量公开活动场馆；单机共享缓存、16 秒查询间隔，详见 docs/integrations.md。

# 服务账号配置：你需要做的步骤

代码、本地数据库、网页、接口和配置工具由我完成。你只需要持有自己的服务账号、完成邮箱/身份验证，以及在本地填写凭据；不用自己写代码。以下控制台名称可能随服务更新略有变化，以官方说明为准。

## 先知道哪些功能不需要这些账号

邮箱密码注册/登录、活动列表、筛选、地图底图、Maybe/Going 看板和冲突检测可以先在本地使用。邮箱验证、密码重置邮件、活动提醒、Google 登录和真实 AI 回答分别需要下面的服务配置。缺失地点坐标的活动需要地理编码服务才能发布。不会用虚构结果替代这些功能。

## 保存配置的方法

项目根目录运行 `.venv/bin/python ops/configure.py`。选择服务编号，按提示在本地输入信息；密钥输入不回显。工具创建 `.env`（已被 Git 忽略，文件权限仅本人读写）。不需要把密钥发到聊天里，也不要写入 NEXT_PUBLIC 环境变量。每次完成后重新启动 API 和 worker；Google 回调域名应始终与 APP_ORIGIN 保持一致。

## 1. OpenAI：活动 AI 问答

1. 打开 [OpenAI Platform](https://platform.openai.com/)，登录或注册自己的账号。
2. 在平台创建或选择项目。API 用量与 ChatGPT 订阅分别管理；按平台提示配置 API 账单，并在项目设置中限制使用权限、查看预算与用量。预算通知不应当作强制停用保证。
3. 在 [API keys](https://platform.openai.com/api-keys) 创建项目密钥，保存到本地 `OPENAI_API_KEY`。
4. 根据该项目可访问的 [模型列表](https://platform.openai.com/docs/models) 选一个支持 Responses API 的文本模型，把准确模型 ID 填入 `OPENAI_MODEL`。不要填写 ChatGPT 界面中的显示名称。
5. 运行配置工具选 2。重启 API 后打开活动详情并提问，确认出现真实回复及来源。

实现基于 [官方 Responses Python/REST 说明](https://developers.openai.com/api/reference/python)，消息不会附带邮箱或当前精确位置。应用默认每用户每分钟 10 次、每天 100 次调用，但这不能替代平台账户的消费控制。

## 2. Google：Google 登录

1. 使用自己的 Google 账号打开 [Google Cloud Console](https://console.cloud.google.com/)，新建项目，例如 `atlanta-activities`。
2. 打开 Google Auth Platform；在 Branding 中填写应用名称、支持邮箱和开发者联系邮箱。在 Audience 中选择适合公开用户的 External，开发时保留测试状态；若控制台要求，添加自己的 Google 邮箱为测试用户。
3. 在 Clients 中创建 OAuth client，类型选择 **Web application**。
4. Authorized JavaScript origins 填 `http://localhost:3000`。Authorized redirect URIs 必须完整填写：`http://localhost:3000/api/auth/google/callback`。不要混用 localhost 与 127.0.0.1。
5. 将 Client ID 和 Client secret 分别通过配置工具选 1 填入 `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`。重启 API。
6. 用 Google 按钮登录测试。如果已用同邮箱注册密码账号，先用密码登录，再到 Settings → Connect Google 绑定。
7. 正式上线后在同一 client 添加 `https://你的域名/api/auth/google/callback`，将应用的 APP_ORIGIN 改成该 HTTPS 域名；按控制台要求完善域名、隐私页面和发布状态。

我们只请求 `openid email profile`，不访问 Google Calendar。详见 [Google 官方 OIDC 配置](https://developers.google.com/identity/openid-connect/openid-connect)。

## 3. Resend：验证、重置密码和活动提醒邮件

1. 打开 [Resend](https://resend.com/)，注册并完成账号验证。
2. 先参考控制台的测试发件人说明向你自己的验证邮箱测试；测试发件人可能限制收件人，不可直接用于公众上线。
3. 公开上线需要你拥有一个域名。可使用已有域名，不需要为本项目立即购买。到 Domains 添加域名或邮件子域名，例如 `mail.你的域名`。
4. 在域名注册商/DNS 托管商中，按 Resend 当前显示的记录逐项添加 SPF/DKIM 等验证记录，不照抄其他域名的值。等待 Resend 显示 Verified。
5. 创建仅发送所需权限的 API key。配置工具选 3，填写 `RESEND_API_KEY`，以及已验证域名的 `MAIL_FROM`，例如 `ATL Out <reminders@mail.你的域名>`。
6. 重启 API 和 worker。使用 Settings → Resend verification email，收信并完成验证；将未来活动放入 Going，设置几分钟后的提醒，确认收信。保持 worker 运行，关闭网页不会影响发送。

[Resend 域名要求](https://resend.com/docs/dashboard/domains/introduction)；[幂等键为 24 小时窗口](https://resend.com/docs/dashboard/emails/idempotency-keys)，代码按更短的安全窗口重试。发信量、收费和限制以账号控制台为准。

## 4. MapTiler：地图和未知地点定位

地图底图默认使用 [OpenFreeMap](https://openfreemap.org/)，无需注册。活动半径与圈选计算由我们自己的 PostGIS 完成，与地图供应商无关。

1. 如果需要 MapTiler 底图或要自动定位来源中的未知场馆，打开 [MapTiler Cloud](https://cloud.maptiler.com/)，注册并查看 [地图与地理编码 API](https://docs.maptiler.com/cloud/api/geocoding/)。
2. 创建浏览器地图 key，限制允许域名为本地站点与将来的正式域名，填入 `MAPTILER_KEY`。浏览器地图 key 会用于加载地图，必须限制来源。
3. 为后端地理编码单独创建 key，确认账号支持地理编码以及活动坐标保存/存储用途，填入 `MAPTILER_GEOCODING_KEY`。这个 key 不进入浏览器。
4. 重启 API/worker，运行 `make ingest`。来源自带坐标或可信场馆表已定位的活动无需额外地理编码。

## 上线前剩余事项

选托管服务与域名后，再配置 HTTPS、生产数据库、常驻 worker、备份和告警。Docker 配置已包含这些进程，但不会自动替你购买云服务或域名。先完成本地验收，再决定托管方式。
