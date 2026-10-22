# Atlanta Activities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完整实现可公开上线的亚特兰大活动发现、地图筛选、个人看板、冲突检测、单次邮件提醒和活动 AI 问答；当前不安排教学。

**Architecture:** Next.js 负责英文界面，通过同源 /api 代理调用 FastAPI；PostgreSQL + PostGIS 为业务与空间查询的唯一事实来源。独立 Python worker 运行持久化采集与邮件任务；数据库事务保证状态更新、冲突检测与提醒撤销的一致性。

**Tech Stack:** TypeScript、React、Next.js App Router；Python、FastAPI、SQLAlchemy、Alembic、PostgreSQL/PostGIS；pytest、Vitest、Playwright。地图优先 MapLibre GL JS，邮件优先 Resend，Google OIDC 使用 Authlib；所有外部集成可通过明确的适配器替换。具体依赖版本在任务 1 根据官方兼容性选择并锁定，不使用未核验的版本号。

**Spec:** `docs/superpowers/specs/2026-10-22-atlanta-activities-design.md`（用户已确认，含最新“先实现、后学习”调整）。

## Global Constraints

- 界面使用英文；开发说明使用中文。当前优先完整实现所有需求，技术栈和技能学习推迟到全部功能完成之后。
- 已选技术：TypeScript + React + Next.js；Python + FastAPI；PostgreSQL + PostGIS。
- 用户必须登录后访问活动功能。支持邮箱密码注册登录、邮箱验证、密码重置和 Google 登录。
- 采用自动收集、自动校验后直接展示。取消人工审核和 Admin 页面。
- 地域为 Downtown Atlanta、Midtown 和 Georgia Tech 校园；周次按 America/New_York 的周一至周日，默认本周。
- 类型多选 OR；周次、类别、地理条件 AND；Radius 和 Draw area 互斥。
- Radius 允许 0.1–50 miles；Polygon 最多 200 个顶点，包含边界，拒绝自交。
- Maybe / Going 看板跨周保留；冲突提示后可确认加入；不计算交通时间。
- 每个用户每个活动最多一封活动提醒邮件；now < remind_at < event.start_at。
- API 密钥只在后端；真实服务未配置或验证时不得宣称集成完成；禁止将 fixtures 伪装为真实活动。
- 不包括 Admin、人工审核、购票、外部日历同步、多次提醒、路线导航。

## Review Focus

1. 同一用户两个标签页并发加入 Going：串行复查，不能绕过冲突确认（任务 7）。
2. 改期/移回 Maybe 与邮件发送同时发生：撤销应阻止尚未提交给邮件服务的发送，记录无法撤回的已提交发送（任务 9）。
3. 来源消失、格式改变或部分返回：保留已发布记录，不误判取消或破坏看板（任务 3）。
4. Google 邮箱撞上现有密码账号：必须先验证已有账号，不能自动接管（任务 5）。
5. 地图仅加载部分结果、快速切换筛选：不展示过时请求，地图不能漏掉列表分页外的匹配活动（任务 6）。

## 文件结构与契约

新增根文件：`README.md`、`.env.example`、`.gitignore`、`compose.yaml`、`Makefile`、`.github/workflows/ci.yml`、`DESIGN.md`。

`apps/api/pyproject.toml` 和锁文件管理 Python 环境；`app/main.py`、`core/config.py`、`core/database.py`、`core/security.py` 为启动、配置、连接与安全公共模块。`app/auth/`、`events/`、`plans/`、`reminders/`、`chat/` 各自包含 `models.py`、`schemas.py`、`service.py`、`router.py`；`ingestion/` 包含 sources、normalize、dedupe、geocode；`worker/` 负责调度与任务领取；`alembic/` 保存迁移；`tests/` 采用对应业务目录。

`apps/web/src/app/` 存路由，`features/{auth,explore,map,plans,chat}/` 存领域交互组件与测试，`lib/{api,types,time}.ts` 保存请求客户端、生成类型和时间格式。`e2e/` 放 Playwright 场景。`ops/` 保存部署说明、备份与恢复脚本。`apps/api/data/coverage.geojson` 存版本化地域边界；`data/venues.json` 存可信场馆坐标；测试样本位于 `tests/fixtures/sources/`，每份注明来源与获取时间。

共享 DTO：`EventDTO{id,title,starts_at,ends_at,venue,latitude,longitude,categories,eligibility,status,version,source_urls,last_verified_at}`；`PlanDTO{event_id,status:maybe|going,position,version,event,conflicts,has_sent_reminder}`；`ConflictDTO{event_id,overlap_start,overlap_end}`；`ReminderDTO{id,event_id,remind_at,status}`。时间为带偏移 ISO 8601，ID 为 UUID。错误为 `{code,message,details}`。FastAPI OpenAPI 生成 TypeScript 类型，CI 检查漂移。

外部选择：MapLibre 负责渲染，MapTiler 提供生产地图和地理编码（限制浏览器地图 key 的域名，地理编码 key 仅后端）；Resend 发验证/重置/提醒邮件。任务 1 核验当前条款、配额、坐标缓存许可和幂等窗口；如不可用，先记录可用替代供应商的接口映射及原因，再推进集成。服务账号、收费与部署由用户拥有；编写集成和本地验证不依赖先购买服务，真实验收必须使用真实凭据。

## Task 1: 可运行工程、供应商与来源核验

**Files:** 创建根配置、`apps/web/package.json`、`apps/web/next.config.ts`、`apps/api/pyproject.toml`、`app/main.py`、`core/{config,database}.py`、`tests/test_health.py`、`docs/integrations.md`。

**Interfaces:** 提供 `GET /api/health -> {status:"ok"}`；`get_session() -> AsyncIterator[AsyncSession]`；`Settings` 读取 DATABASE_URL、APP_ORIGIN、GOOGLE_CLIENT_ID/SECRET、OPENAI_API_KEY、OPENAI_MODEL、RESEND_API_KEY、MAIL_FROM、MAPTILER_KEY、MAPTILER_GEOCODING_KEY。Next.js 代理 `/api/:path*` 到 FastAPI。

- [ ] 查阅供应商官方文档，记录 SDK/服务配置、域名验证、Google redirect URI、收费前提与限额；检查来源抓取政策、robots、结构化数据及分页。已发现的入口为 [Georgia Tech Calendar](https://calendar.gatech.edu/event-search)、[Discover Atlanta](https://discoveratlanta.com/events/main/)，仅表示入口存在，不表示采集授权或 API 已确认；补查 GT Athletics 和 Downtown/Midtown 主要场馆官方日历以覆盖比赛、演出和游行。
- [ ] 在 `test_health.py::test_health_checks_database` 写断言：健康状态依赖真实 PostGIS 数据库连接，数据库不可用返回 503；运行 `cd apps/api && uv run pytest tests/test_health.py -q`，确认未实现失败。
- [ ] 搭建 web/api/db/worker 容器、配置校验和健康接口；开发数据库使用 PostGIS 镜像，生产启动禁止使用弱默认密钥；安装并锁定依赖。
- [ ] `docker compose up -d db` 后重跑该测试，期望 PASS；`cd apps/web && npm run build` 期望成功。`README.md` 写入准确启动命令，初始化 Git（当前目录非仓库），提交此任务文件，后续任务结束各做一次聚焦提交。

## Task 2: 数据模型、迁移与时空基础

**Files:** 创建领域 `models.py`、`app/events/{time,spatial}.py`、`alembic/versions/0001_initial.py`、`data/coverage.geojson`、`tests/events/test_time_spatial.py`。

**Interfaces:** `week_bounds(now: datetime, week: Literal["this","next"]) -> tuple[datetime,datetime]` 返回 UTC 周界；`validate_polygon(geojson: dict) -> dict`；数据库实体按设计第 9 节实现，事件独立于用户看板，发送历史独立于可删除的卡片。

- [ ] 写 `test_week_dst_boundaries`（2026-10-26 到 2026-11-02 为 169 小时）、`test_adjacent_intervals_do_not_overlap`、`test_polygon_includes_boundary`、`test_polygon_rejects_self_intersection_and_over_200_vertices`；运行 `uv run pytest tests/events/test_time_spatial.py -q`，确认 RED。
- [ ] 实现迁移、唯一约束、外键、空间和到期任务索引；基于可追溯的地域资料绘制并记录覆盖边界，使用地图样本核验校园及关键场馆归属；坐标不凭空编写。
- [ ] 在空库执行 `uv run alembic upgrade head`，运行测试期望 PASS；测试数据库执行 downgrade/upgrade 确认可恢复，提交模型与迁移。

## Task 3: 真实采集、规范化与更新

**Files:** 创建 `app/ingestion/{contracts,normalize,dedupe,geocode,service}.py`、`sources/{gatech,discover_atlanta,venues}.py`、`app/worker/{main,scheduler}.py`、`tests/ingestion/test_pipeline.py` 和来源样本。

**Interfaces:** `SourceAdapter.fetch(window_start,window_end) -> AsyncIterator[RawEvent]`；`ingest_source(source_id: UUID, now: datetime) -> RunSummary`；`upsert_event(candidate: NormalizedEvent) -> EventChange`。`EventChange` 包含 before/after 版本、时间和取消状态，供任务 7、9 处理。

- [ ] 写测试 `test_repeat_ingestion_is_idempotent`、`test_missing_page_does_not_cancel_events`、`test_source_failure_does_not_clear_published_events`、`test_changed_time_increments_version`、`test_bad_location_is_not_published`、`test_recurring_occurrences_stay_distinct`、`test_campus_eligibility_is_preserved`；以真实页面快照做解析 fixture，运行 `uv run pytest tests/ingestion -q` 确认 RED。
- [ ] 实现任务 1 核验可读取的各适配器，解析结构化数据或许可的 HTML；规范化时区、来源、分类和资格，排除纯线上及非娱乐条目。优先可信场馆坐标，其余地理编码并缓存；自动校验后发布，错误仅进运行日志，无人工审核队列。
- [ ] 实现来源内稳定 ID、跨来源高置信去重、稳定 canonical ID 和计划引用迁移；只有明确来源证据才取消。worker 每 6 小时幂等收集本周/下周及已计划的未来活动，24 小时未核实标过时；限制抓取并发、超时与重试。
- [ ] 重跑采集测试期望 PASS；执行 `uv run python -m app.worker.main ingest --once` 获取真实数据并抽查开始时间、资格和坐标；对无法访问来源记录实际缺口，不用模拟数据填补后声称已覆盖。提交本任务。

## Task 4: 活动查询 API 与完整地图结果

**Files:** 创建 `events/{schemas,query,service,router}.py`、`tests/events/test_search.py`；修改 `app/main.py` 注册路由。

**Interfaces:** `search_events(filters: EventFilters, now: datetime) -> EventPage`；`EventFilters{week,categories,geo_mode,center,radius_m,polygon,cursor}`；GET `/events`、POST `/events/search`、GET `/events/{id}`、POST `/events/map` 返回同一过滤集合的点或聚合及总数，地图不依赖列表页码。

- [ ] 写 `test_category_or_geo_and`、`test_radius_boundary_and_limits`、`test_cross_week_event_and_unknown_end`、`test_map_contains_events_beyond_first_page`、`test_missing_event_returns_404`；运行 `uv run pytest tests/events/test_search.py -q` 确认 RED。
- [ ] 实现参数化空间查询、稳定游标分页、集合数量与地图聚合；拒绝 Radius/Polygon 同时传入、非法坐标、非法距离与超大输入，时间未知遵从设计；API 登录保护在任务 5 接入。
- [ ] 重跑测试，使用 PostGIS 查询计划确认空间索引可用，输出 OpenAPI，提交任务。

## Task 5: 邮箱与 Google 身份、会话和账号管理

**Files:** 创建 `auth/{schemas,service,router,google}.py`、`core/security.py`、`reminders/email.py`、`tests/auth/test_auth.py`；创建 web `app/(auth)/{login,register,verify,reset}/page.tsx`、`app/settings/page.tsx`、`features/auth/*`。

**Interfaces:** `require_user(request, session) -> User`；`EmailGateway.send(message, idempotency_key) -> SendResult`；`/auth/{register,login,logout,verify,forgot-password,reset-password,google/start,google/callback}`；`/me/account` 和 `/me/identities`。cookie 会话由数据库管理，CSRF token 由 session 接口提供。

- [ ] 写 `test_password_verify_reset_revoke_sessions`、`test_google_same_email_requires_authenticated_link`、`test_google_callback_checks_state_nonce_pkce`、`test_cross_user_access_forbidden`、`test_csrf_and_rate_limits`、`test_delete_account_cancels_jobs`、`test_cannot_unlink_last_identity`；运行 `uv run pytest tests/auth -q` 确认 RED。
- [ ] 实现 Argon2id 密码哈希、随机单次验证/重置 token（存哈希）、有效期、请求频率限制、无邮箱枚举回复、退出撤销和同源安全 cookie。Google subject 唯一；邮箱已存在时引导登录绑定，绝不自动合并。
- [ ] 实现英文表单、错误和加载状态、邮箱验证提示、绑定/解绑、删除账号；保护全部业务 API 和 web 页面；通过 Next 代理正确传递 cookie 与回调地址。
- [ ] 重跑 auth 测试，`npm run typecheck`；真实测试账号完成 Google 回调与邮件验证后记录凭据条件和结果，提交任务。

## Task 6: Explore、地图、圈选与响应式界面

**Files:** 创建 `DESIGN.md`、`app/explore/page.tsx`、`features/explore/{Filters,EventList,EventDetails}.tsx`、`features/map/{ActivityMap,GeoControls,PolygonDraw}.tsx`、`lib/{api,types,time}.ts`、`e2e/explore.spec.ts`。

**Interfaces:** `ExploreFilters` 与 API `EventFilters` 一一映射；`useEventSearch(filters)` 返回列表、地图集合、总数与加载/错误状态；`apiFetch<T>(path,options) -> Promise<T>` 统一会话、CSRF 与错误。

- [ ] 实施前按要求读取 frontend-design 与 frontend-design-premium 技能，创建一致的 DESIGN.md；设计英文品牌、排版、状态、移动端布局，不新增功能审批轮次。
- [ ] 写浏览器场景 `week_filter_keeps_geo_and_categories`、`location_denied_allows_manual_center`、`polygon_clear_switches_mode`、`stale_response_does_not_replace_current_search`、`map_and_list_share_total`；运行 `npx playwright test e2e/explore.spec.ts` 确认 RED。
- [ ] 实现 MapLibre + 生产地图供应商、活动聚合和选中联动，首次主动定位才请求权限；画圈实际采用可编辑多边形。URL 保存非敏感筛选但不默认公开精确定位；快速查询 abort/序列防旧响应覆盖。地图不可用时列表仍能操作。
- [ ] 实现本周/下周日期显示、类别多选、miles 滑块/数字输入、来源和资格、未知/过时/取消标记；检验真实列表与地图数量，跑浏览器测试和手机尺寸验收，提交任务。

## Task 7: 看板、排序、并发冲突确认

**Files:** 创建 `plans/{schemas,service,router,conflicts}.py`、`tests/plans/test_plans.py`、`app/my-plans/page.tsx`、`features/plans/{Board,PlanCard,ConflictDialog}.tsx`、`e2e/plans.spec.ts`。

**Interfaces:** `move_plan(user_id,event_id,target,expected_version,confirmation_token=None) -> PlanDTO | ConflictChallenge`；`ConflictChallenge{token,conflicts,unknown_end_events}`，token 绑定用户、目标活动版本和当前 Going 集合指纹。`/me/plans` 提供列取回、添加、移动、删除、排序；移回 Maybe/删除调用任务 9 的取消服务。

- [ ] 写 `test_overlap_requires_confirmation`、`test_adjoining_events_allowed`、`test_unknown_end_requires_acknowledgment`、`test_parallel_add_rechecks_going_set`、`test_stale_confirmation_is_rejected`、`test_reorder_does_not_change_other_users`；运行 `uv run pytest tests/plans -q` 确认 RED。
- [ ] 使用事务中用户行锁串行化用户看板变更；确认 token 有限期并要求集合仍匹配。取消确认时按来源保持或加入 Maybe。独立计算持久卡片的最新冲突；改期、删除和取消触发重算。
- [ ] 用 dnd-kit 实现两列与列内排序，提供移动按钮、键盘可达操作、失败回滚、过期版本刷新和冲突对话框；显示已结束及提醒状态，跨周保留。
- [ ] 运行单元及真实数据库并发测试；`npx playwright test e2e/plans.spec.ts` 验证两标签并发、拖动和按钮，提交任务。

## Task 8: 提醒设置与状态规则

**Files:** 创建 `reminders/{schemas,service,router}.py`、`tests/reminders/test_rules.py`、`features/plans/ReminderDialog.tsx`、`e2e/reminders.spec.ts`。

**Interfaces:** `set_reminder(user_id,event_id,remind_at: datetime,now: datetime) -> ReminderDTO`；`cancel_pending_reminder(user_id,event_id,reason) -> None`；`invalidate_event_reminders(event_id,new_version,reason) -> int`。PUT/GET/DELETE `/me/plans/{event_id}/reminder`。

- [ ] 写 `test_only_verified_going_can_set`、`test_strict_time_bounds`、`test_sent_history_survives_remove_and_readd`、`test_reschedule_cancels_pending`、`test_dst_ambiguous_time_requires_offset`；运行 `uv run pytest tests/reminders/test_rules.py -q` 确认 RED。
- [ ] 实现单用户单活动有效提醒及永久发送历史约束，事务内校验活动版本和资格；接入 Maybe、删除、改期与取消事件。过期活动禁止重设，未发送取消后可再设。
- [ ] 实现四个快捷选项、禁用原因、自定义 NY 时间和明确 DST 偏移、收件邮箱展示、修改/取消/失败状态；从服务端 now 校正前端判断。
- [ ] 重跑规则测试与浏览器提醒场景，确认冲突活动仍各自可设置一次，提交任务。

## Task 9: 提醒 worker、邮件幂等和竞态

**Files:** 创建 `reminders/{delivery,templates}.py`、`worker/jobs.py`、`tests/reminders/test_delivery.py`、`ops/reminders.md`；修改采集和计划服务接入失效逻辑。

**Interfaces:** `deliver_due_reminders(now: datetime, batch_size: int=100) -> DeliverySummary`；领取使用 `FOR UPDATE SKIP LOCKED`、lease 和有限重试；`EmailGateway` 遵从任务 5。每封邮件有稳定 provider idempotency_key，provider message ID 与结果未知状态持久化。

- [ ] 写 `test_two_workers_submit_one_message`、`test_cancel_before_submit_suppresses_send`、`test_reschedule_before_submit_suppresses_send`、`test_late_before_start_sends_and_after_start_expires`、`test_timeout_does_not_blindly_resend`、`test_retry_outside_provider_idempotency_window_is_not_automatic`；运行 `uv run pytest tests/reminders/test_delivery.py -q` 确认 RED。
- [ ] worker 每分钟执行到期扫描；领取后、提交前重查活动版本、Going、邮箱验证。用用户/活动一致锁顺序协调撤销；定义邮件已提交外部服务为不可撤回边界，不长期持有数据库事务跨网络。超时先进入结果未知，按官方幂等保证查询/重试，过安全窗口停止并记录失败。
- [ ] 英文邮件含活动当地时间、地点、来源和返回 My Plans 链接；用户输入转义，不含精确当前位置。邮件失败不修改 Going 状态。
- [ ] 跑 worker 并发集成测试，真实测试邮箱验证短时提醒及取消；保存 provider message ID 和可脱敏日志，提交任务。

## Task 10: 活动上下文 AI 问答

**Files:** 创建 `chat/{schemas,service,router,prompt}.py`、`tests/chat/test_chat.py`、`features/chat/ActivityChat.tsx`、`e2e/chat.spec.ts`。

**Interfaces:** `answer_activity_question(user_id,event_id,message,session_id=None) -> ChatReply{session_id,message,source_urls,event_version}`；POST `/events/{id}/chat`；GET/DELETE `/me/chats/{id}`。OpenAI SDK 调用仅在 FastAPI，模型通过 OPENAI_MODEL 配置。

- [ ] 写 `test_other_users_chat_is_inaccessible`、`test_prompt_contains_current_event_version_and_sources`、`test_source_text_cannot_trigger_tools`、`test_limit_and_provider_failure_are_explicit`、`test_chat_delete_removes_messages`；运行 `uv run pytest tests/chat -q` 确认 RED。
- [ ] 在实现前读取 openai-docs 技能并按官方当前接口接入 SDK；限制用户消息 4000 字符、每分钟 10 次、每用户每天 100 次，可配置；限制上下文与输出 token，不启用业务写工具、不发送位置数据、不联网臆测活动事实。会话使用最新活动资料并标明更新时间。
- [ ] 英文 UI 支持跟随提问语言回复、来源、加载、重试、删除会话及预算用尽提示；聊天故障不阻断活动/看板。用可控 mock 验证错误路径，用真实 API 检查缺失信息、双语与恶意来源文本回答；记录模型和结果，提交任务。

## Task 11: 端到端验证、运维和上线包

**Files:** 创建 `.github/workflows/ci.yml`、`e2e/journey.spec.ts`、`ops/{deployment,privacy,acceptance}.md`、`ops/{backup,restore}.sh`；更新 README、环境模板和容器定义。

**Interfaces:** `make check` 运行 lint/typecheck、Python 测试、web 测试和 build；`make e2e` 启动测试服务与 Playwright；`make ingest`、`make worker` 提供单独运行入口；health/readiness 暴露必要状态且不泄露配置。

- [ ] 写 `journey.spec.ts`：注册验证 → 登录 → 本周/下周 → 类别+半径/圈选 → 详情/AI → Maybe/Going → 冲突确认 → 一次提醒 → 移回 Maybe 撤销；另覆盖手机、键盘、拒绝定位、AI/地图不可用。先确认缺失路径失败，再修复产品代码。
- [ ] 运行 `make check` 和 `make e2e`，期望全部通过；检查生产构建无密钥、匿名 API 被拒、cookie/CSRF/权限、地图 key 域名限制和持久化数据重启恢复。
- [ ] 配置 HTTPS 和反向代理、数据库备份与实际恢复演练、worker 健康状态、采集超过 24 小时及提醒失败告警；日志脱敏。生产部署不依赖 web 请求激活 worker。撰写隐私说明、账号删除和已配置供应商记录。
- [ ] 真实集成验收逐项记录来源/样本、地图定位、Google 登录、OpenAI 响应和邮件发送；缺凭据时保留明确未验收项，继续完成其余工作，不以 build 通过替代真实验收。用户提供凭据时通过安全配置方式，不要求在聊天贴密钥。
- [ ] 在 `ops/acceptance.md` 将每项需求映射到页面、API、测试及实际结果；完成代码审查和适当复验，提交最终改动。准备可审阅的部署配置；按当前部署授权处理上线，不能擅自购买服务。交付启动方式、验证结果、必要运行成本与仍受外部条件限制的项目，不穿插技术教学。

## 计划自查与执行交接

覆盖关系：设计 1–2 对应任务 3–7；地图与空间查询对应 2、4、6；自动采集对应 1、3；冲突对应 7；提醒对应 8–9；AI 对应 10；账号权限对应 5；数据/API 对应 2、4–10；验证上线对应 11。任务 1、3 的来源核验必须先于声称数据覆盖，任务 5、9、10 的真实验收不能被 fixtures 替代。

本计划按一个集成产品组织为独立可验收的工作包，依赖顺序为 1→2→3→4→5→6→7→8→9→10→11；无需每包再重新进行需求确认。供应商凭据只阻塞相应真实验收，不阻塞其他代码开发。执行前由用户审阅计划并选择执行方式；Native 在本会话连续实现，Subagent-driven 由分任务实现与复核代理推进。推荐 Native，因接口关联紧密且用户优先完整交付；若用户选择委派再按对应技能执行。
