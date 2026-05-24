SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict IvjD3Taon3cC0uSmYduc2fNu5kalIFeib8FUc1g7icq7dnhPEAM7A8k3mN00zrQ

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."audit_log_entries" ("instance_id", "id", "payload", "created_at", "ip_address") FROM stdin;
00000000-0000-0000-0000-000000000000	3c8605a0-d92f-461f-b0dc-6118d8ac291c	{"action":"login","actor_id":"00000000-0000-0000-0000-000000000005","actor_name":"Linda Chen","actor_username":"qc@demo.fabsimple.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-05-24 09:00:44.711572+00	
00000000-0000-0000-0000-000000000000	d38fd0be-c93f-4c84-81ac-37e85ba330ba	{"action":"login","actor_id":"00000000-0000-0000-0000-000000000001","actor_name":"Vinay Patel","actor_username":"owner@demo.fabsimple.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-05-24 09:08:49.563842+00	
00000000-0000-0000-0000-000000000000	90009dad-e8fd-4cae-a443-d158f8993eb8	{"action":"login","actor_id":"00000000-0000-0000-0000-000000000001","actor_name":"Vinay Patel","actor_username":"owner@demo.fabsimple.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-05-24 09:09:00.918205+00	
00000000-0000-0000-0000-000000000000	fdf6e919-a699-4176-a672-df4982472cf7	{"action":"login","actor_id":"00000000-0000-0000-0000-000000000001","actor_name":"Vinay Patel","actor_username":"owner@demo.fabsimple.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-05-24 09:09:55.415867+00	
00000000-0000-0000-0000-000000000000	18c41dea-2c69-4378-9e97-8b11949d50c5	{"action":"login","actor_id":"00000000-0000-0000-0000-000000000001","actor_name":"Vinay Patel","actor_username":"owner@demo.fabsimple.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-05-24 09:27:25.392973+00	
00000000-0000-0000-0000-000000000000	5bfc95c0-4e99-4129-bae3-310e17bdc304	{"action":"login","actor_id":"00000000-0000-0000-0000-000000000001","actor_name":"Vinay Patel","actor_username":"owner@demo.fabsimple.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-05-24 09:27:33.381368+00	
00000000-0000-0000-0000-000000000000	fb180788-b637-49e8-aaab-70282a389ffc	{"action":"login","actor_id":"00000000-0000-0000-0000-000000000001","actor_name":"Vinay Patel","actor_username":"owner@demo.fabsimple.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-05-24 11:30:20.172853+00	
00000000-0000-0000-0000-000000000000	1b06659d-48a5-488f-aec4-c43c983bb7d2	{"action":"login","actor_id":"00000000-0000-0000-0000-000000000001","actor_name":"Vinay Patel","actor_username":"owner@demo.fabsimple.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-05-24 11:31:56.390081+00	
00000000-0000-0000-0000-000000000000	4f807e7e-d114-47d3-8a7f-e1baf5bbbc71	{"action":"login","actor_id":"00000000-0000-0000-0000-000000000005","actor_name":"Linda Chen","actor_username":"qc@demo.fabsimple.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-05-24 11:32:24.21237+00	
00000000-0000-0000-0000-000000000000	c920b2ff-a0f5-40f4-b9f7-f610a1b0657b	{"action":"login","actor_id":"00000000-0000-0000-0000-000000000001","actor_name":"Vinay Patel","actor_username":"owner@demo.fabsimple.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-05-24 11:55:23.215534+00	
00000000-0000-0000-0000-000000000000	128513b3-b8e5-43e5-9ece-672e306492a7	{"action":"logout","actor_id":"00000000-0000-0000-0000-000000000001","actor_name":"Vinay Patel","actor_username":"owner@demo.fabsimple.io","actor_via_sso":false,"log_type":"account"}	2026-05-24 12:14:46.406889+00	
00000000-0000-0000-0000-000000000000	3ec5b1a1-e803-41f8-b29e-343ddb6bae28	{"action":"login","actor_id":"00000000-0000-0000-0000-000000000001","actor_name":"Vinay Patel","actor_username":"owner@demo.fabsimple.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-05-24 12:17:49.238327+00	
00000000-0000-0000-0000-000000000000	54a31e49-e301-460b-9444-e0957cf570af	{"action":"login","actor_id":"00000000-0000-0000-0000-000000000001","actor_name":"Vinay Patel","actor_username":"owner@demo.fabsimple.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-05-24 12:21:31.562745+00	
00000000-0000-0000-0000-000000000000	41cfd55f-02ff-402e-bd57-773aa815b2e7	{"action":"logout","actor_id":"00000000-0000-0000-0000-000000000001","actor_name":"Vinay Patel","actor_username":"owner@demo.fabsimple.io","actor_via_sso":false,"log_type":"account"}	2026-05-24 12:22:46.097862+00	
00000000-0000-0000-0000-000000000000	dab6a48f-8238-45f1-a279-8dc2c9372f70	{"action":"login","actor_id":"00000000-0000-0000-0000-000000000001","actor_name":"Vinay Patel","actor_username":"owner@demo.fabsimple.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-05-24 12:22:49.450049+00	
00000000-0000-0000-0000-000000000000	013700b3-3bdf-4e1c-8bf3-bb504f250f43	{"action":"logout","actor_id":"00000000-0000-0000-0000-000000000001","actor_name":"Vinay Patel","actor_username":"owner@demo.fabsimple.io","actor_via_sso":false,"log_type":"account"}	2026-05-24 12:27:14.902748+00	
00000000-0000-0000-0000-000000000000	88462a43-f7f4-49b6-b55c-ca487bc8f8f1	{"action":"login","actor_id":"00000000-0000-0000-0000-000000000001","actor_name":"Vinay Patel","actor_username":"owner@demo.fabsimple.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-05-24 12:28:14.396035+00	
00000000-0000-0000-0000-000000000000	aaa4b0ab-2546-416b-9ecf-89ab72650ae6	{"action":"logout","actor_id":"00000000-0000-0000-0000-000000000001","actor_name":"Vinay Patel","actor_username":"owner@demo.fabsimple.io","actor_via_sso":false,"log_type":"account"}	2026-05-24 12:29:51.311479+00	
00000000-0000-0000-0000-000000000000	63517b9a-b009-4c32-91a8-b6c82a5b22f6	{"action":"login","actor_id":"00000000-0000-0000-0000-000000000001","actor_name":"Vinay Patel","actor_username":"owner@demo.fabsimple.io","actor_via_sso":false,"log_type":"account","traits":{"provider":"email"}}	2026-05-24 12:29:54.424532+00	
\.


--
-- Data for Name: custom_oauth_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."custom_oauth_providers" ("id", "provider_type", "identifier", "name", "client_id", "client_secret", "acceptable_client_ids", "scopes", "pkce_enabled", "attribute_mapping", "authorization_params", "enabled", "email_optional", "issuer", "discovery_url", "skip_nonce_check", "cached_discovery", "discovery_cached_at", "authorization_url", "token_url", "userinfo_url", "jwks_uri", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."flow_state" ("id", "user_id", "auth_code", "code_challenge_method", "code_challenge", "provider_type", "provider_access_token", "provider_refresh_token", "created_at", "updated_at", "authentication_method", "auth_code_issued_at", "invite_token", "referrer", "oauth_client_state_id", "linking_target_id", "email_optional") FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") FROM stdin;
00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000002	authenticated	authenticated	pm@demo.fabsimple.io	$2a$06$XiiKvZ5AsQ.9EVJgOt/IpuqqUWkvckRawcB5rN5rJs/4aPragg1O6	2026-05-24 09:00:30.514794+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"full_name": "Sarah Mitchell"}	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000003	authenticated	authenticated	estimator@demo.fabsimple.io	$2a$06$VYWbfDOPLbzgzEkR/V7dv.GLfJGHK63n/dfSUb.yT5h6w85Z0/YcS	2026-05-24 09:00:30.514794+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"full_name": "David Park"}	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000004	authenticated	authenticated	foreman@demo.fabsimple.io	$2a$06$AeVr3wBwPRMZMzL7APO2pOJ96JA7FgRd2ksqIesQwoZ6XYU/4VEQe	2026-05-24 09:00:30.514794+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"full_name": "Marcus Johnson"}	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000006	authenticated	authenticated	accounting@demo.fabsimple.io	$2a$06$4vLmrSODompPNIIcCCO0p.XLXQS3uooblC404O4pBk3Q8AotFZt7a	2026-05-24 09:00:30.514794+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"full_name": "Rachel Kim"}	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000007	authenticated	authenticated	worker@demo.fabsimple.io	$2a$06$gAzjPkdV1DPw.gnt9Sf0v.qKqjRC26IasSM.NyOwHxgCprCgc9dle	2026-05-24 09:00:30.514794+00	\N		\N		\N			\N	\N	{"provider": "email", "providers": ["email"]}	{"full_name": "Roberto Torres"}	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000005	authenticated	authenticated	qc@demo.fabsimple.io	$2a$06$1qKbGtkDw7neMAccVOO1VOp3K1gC7QSPgkkvVuVg14n3nKwKHdojW	2026-05-24 09:00:30.514794+00	\N		\N		\N			\N	2026-05-24 11:32:24.213721+00	{"provider": "email", "providers": ["email"]}	{"full_name": "Linda Chen"}	\N	2026-05-24 09:00:30.514794+00	2026-05-24 11:32:24.216848+00	\N	\N			\N		0	\N		\N	f	\N	f
00000000-0000-0000-0000-000000000000	00000000-0000-0000-0000-000000000001	authenticated	authenticated	owner@demo.fabsimple.io	$2a$06$tk2bmhTgO2rq2gKYMeJGIuwUPdjG/zgC5aw1Tb1aM8tHdclqJ.Hru	2026-05-24 09:00:30.514794+00	\N		\N		\N			\N	2026-05-24 12:29:54.42551+00	{"provider": "email", "providers": ["email"]}	{"full_name": "Vinay Patel"}	\N	2026-05-24 09:00:30.514794+00	2026-05-24 12:29:54.428021+00	\N	\N			\N		0	\N		\N	f	\N	f
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") FROM stdin;
00000000-0000-0000-0000-000000000001	00000000-0000-0000-0000-000000000001	{"sub": "00000000-0000-0000-0000-000000000001", "email": "owner@demo.fabsimple.io", "email_verified": true, "phone_verified": false}	email	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	ff15baa4-a469-40fd-a9f2-563166e86b1b
00000000-0000-0000-0000-000000000002	00000000-0000-0000-0000-000000000002	{"sub": "00000000-0000-0000-0000-000000000002", "email": "pm@demo.fabsimple.io", "email_verified": true, "phone_verified": false}	email	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	09a40b0f-85ad-49f3-a3b0-34910b9d9948
00000000-0000-0000-0000-000000000003	00000000-0000-0000-0000-000000000003	{"sub": "00000000-0000-0000-0000-000000000003", "email": "estimator@demo.fabsimple.io", "email_verified": true, "phone_verified": false}	email	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	d930712a-6187-44d8-83a5-00cb2f02cd7e
00000000-0000-0000-0000-000000000004	00000000-0000-0000-0000-000000000004	{"sub": "00000000-0000-0000-0000-000000000004", "email": "foreman@demo.fabsimple.io", "email_verified": true, "phone_verified": false}	email	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	127dcdc6-ea9a-491c-9c35-91e47749a00f
00000000-0000-0000-0000-000000000005	00000000-0000-0000-0000-000000000005	{"sub": "00000000-0000-0000-0000-000000000005", "email": "qc@demo.fabsimple.io", "email_verified": true, "phone_verified": false}	email	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	4a7d2006-728d-4414-9008-217dd7c709c2
00000000-0000-0000-0000-000000000006	00000000-0000-0000-0000-000000000006	{"sub": "00000000-0000-0000-0000-000000000006", "email": "accounting@demo.fabsimple.io", "email_verified": true, "phone_verified": false}	email	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	abdebe48-d7ff-423d-a595-1a7f1c631431
00000000-0000-0000-0000-000000000007	00000000-0000-0000-0000-000000000007	{"sub": "00000000-0000-0000-0000-000000000007", "email": "worker@demo.fabsimple.io", "email_verified": true, "phone_verified": false}	email	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	08a037de-6b13-4b5c-8647-f8fd5eb6885b
\.


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."instances" ("id", "uuid", "raw_base_config", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_clients" ("id", "client_secret_hash", "registration_type", "redirect_uris", "grant_types", "client_name", "client_uri", "logo_uri", "created_at", "updated_at", "deleted_at", "client_type", "token_endpoint_auth_method") FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") FROM stdin;
510daef4-11c1-497d-a2c6-780c8b3564a9	00000000-0000-0000-0000-000000000005	2026-05-24 09:00:44.712637+00	2026-05-24 09:00:44.712637+00	\N	aal1	\N	\N	curl/8.6.0	172.67.135.174	\N	\N	\N	\N	\N
560c522d-f914-4084-8875-815519dddf8c	00000000-0000-0000-0000-000000000005	2026-05-24 11:32:24.21385+00	2026-05-24 11:32:24.21385+00	\N	aal1	\N	\N	curl/8.6.0	162.247.241.2	\N	\N	\N	\N	\N
37233d83-3628-49bc-af2f-69f5982d2672	00000000-0000-0000-0000-000000000001	2026-05-24 12:29:54.425564+00	2026-05-24 12:29:54.425564+00	\N	aal1	\N	\N	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	162.247.243.32	\N	\N	\N	\N	\N
\.


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") FROM stdin;
510daef4-11c1-497d-a2c6-780c8b3564a9	2026-05-24 09:00:44.715471+00	2026-05-24 09:00:44.715471+00	password	5deea467-a8bc-4a52-b5ef-bdc61a9eb745
560c522d-f914-4084-8875-815519dddf8c	2026-05-24 11:32:24.2174+00	2026-05-24 11:32:24.2174+00	password	b80e8ae3-da21-4f01-96dd-a0dc9060206b
37233d83-3628-49bc-af2f-69f5982d2672	2026-05-24 12:29:54.428377+00	2026-05-24 12:29:54.428377+00	password	c1f545d8-91cd-46dc-9068-16b1e1b5b117
\.


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_factors" ("id", "user_id", "friendly_name", "factor_type", "status", "created_at", "updated_at", "secret", "phone", "last_challenged_at", "web_authn_credential", "web_authn_aaguid", "last_webauthn_challenge_data") FROM stdin;
\.


--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."mfa_challenges" ("id", "factor_id", "created_at", "verified_at", "ip_address", "otp_code", "web_authn_session_data") FROM stdin;
\.


--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_authorizations" ("id", "authorization_id", "client_id", "user_id", "redirect_uri", "scope", "state", "resource", "code_challenge", "code_challenge_method", "response_type", "status", "authorization_code", "created_at", "expires_at", "approved_at", "nonce") FROM stdin;
\.


--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_client_states" ("id", "provider_type", "code_verifier", "created_at") FROM stdin;
\.


--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."oauth_consents" ("id", "user_id", "client_id", "scopes", "granted_at", "revoked_at") FROM stdin;
\.


--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."one_time_tokens" ("id", "user_id", "token_type", "token_hash", "relates_to", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") FROM stdin;
00000000-0000-0000-0000-000000000000	1	hijb7nel5jip	00000000-0000-0000-0000-000000000005	f	2026-05-24 09:00:44.714138+00	2026-05-24 09:00:44.714138+00	\N	510daef4-11c1-497d-a2c6-780c8b3564a9
00000000-0000-0000-0000-000000000000	41	sucq5hmlexpf	00000000-0000-0000-0000-000000000005	f	2026-05-24 11:32:24.215486+00	2026-05-24 11:32:24.215486+00	\N	560c522d-f914-4084-8875-815519dddf8c
00000000-0000-0000-0000-000000000000	47	jrhwbz4afhdx	00000000-0000-0000-0000-000000000001	f	2026-05-24 12:29:54.427149+00	2026-05-24 12:29:54.427149+00	\N	37233d83-3628-49bc-af2f-69f5982d2672
\.


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sso_providers" ("id", "resource_id", "created_at", "updated_at", "disabled") FROM stdin;
\.


--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."saml_providers" ("id", "sso_provider_id", "entity_id", "metadata_xml", "metadata_url", "attribute_mapping", "created_at", "updated_at", "name_id_format") FROM stdin;
\.


--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."saml_relay_states" ("id", "sso_provider_id", "request_id", "for_email", "redirect_to", "created_at", "updated_at", "flow_state_id") FROM stdin;
\.


--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."sso_domains" ("id", "sso_provider_id", "domain", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: webauthn_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."webauthn_challenges" ("id", "user_id", "challenge_type", "session_data", "created_at", "expires_at") FROM stdin;
\.


--
-- Data for Name: webauthn_credentials; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

COPY "auth"."webauthn_credentials" ("id", "user_id", "credential_id", "public_key", "attestation_type", "aaguid", "sign_count", "transports", "backup_eligible", "backed_up", "friendly_name", "created_at", "updated_at", "last_used_at") FROM stdin;
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."companies" ("id", "name", "aisc_cert", "plan", "max_parts", "max_projects", "max_users", "active", "created_at", "updated_at") FROM stdin;
aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	NOVUSsteel Demo Shop	t	professional	50000	25	25	t	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."users" ("id", "auth_id", "company_id", "role", "full_name", "email", "phone", "is_active", "last_login", "created_at", "updated_at") FROM stdin;
11111111-1111-1111-1111-111111111102	00000000-0000-0000-0000-000000000002	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	pm	Sarah Mitchell	pm@demo.fabsimple.io	\N	t	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
11111111-1111-1111-1111-111111111103	00000000-0000-0000-0000-000000000003	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	estimator	David Park	estimator@demo.fabsimple.io	\N	t	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
11111111-1111-1111-1111-111111111104	00000000-0000-0000-0000-000000000004	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	foreman	Marcus Johnson	foreman@demo.fabsimple.io	\N	t	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
11111111-1111-1111-1111-111111111106	00000000-0000-0000-0000-000000000006	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	accounting	Rachel Kim	accounting@demo.fabsimple.io	\N	t	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
11111111-1111-1111-1111-111111111107	00000000-0000-0000-0000-000000000007	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	worker	Roberto Torres	worker@demo.fabsimple.io	\N	t	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
11111111-1111-1111-1111-111111111105	00000000-0000-0000-0000-000000000005	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	qc	Linda Chen	qc@demo.fabsimple.io	\N	t	2026-05-24 11:32:25.57+00	2026-05-24 09:00:30.514794+00	2026-05-24 11:32:25.571802+00
11111111-1111-1111-1111-111111111101	00000000-0000-0000-0000-000000000001	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	owner	Vinay Patel	owner@demo.fabsimple.io	\N	t	2026-05-24 12:32:48.135+00	2026-05-24 09:00:30.514794+00	2026-05-24 12:32:48.136646+00
\.


--
-- Data for Name: activity_feed; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."activity_feed" ("id", "company_id", "user_id", "user_name", "action", "entity_type", "entity_id", "entity_label", "metadata", "created_at") FROM stdin;
2952832a-920b-4ce2-8e45-17b654d25de4	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111107	Roberto Torres	updated part status to In Progress	parts	\N	W14x82-1044	{}	2026-05-24 08:58:30.514794+00
97934263-cbc3-4bf0-9204-780d4f190af7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111104	Marcus Johnson	logged daily production	daily_production_log	\N	Bay 1	{}	2026-05-24 08:48:30.514794+00
f84e1f99-df77-445f-8483-28220923dfe7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	Linda Chen	passed weld inspection	weld_inspections	\N	WLD-0042	{}	2026-05-24 08:26:30.514794+00
66bf02e8-6f90-42b2-88ee-7fcce22bb3ad	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	Sarah Mitchell	approved change order	change_orders	\N	CO-042	{"amount": 12400}	2026-05-24 08:00:30.514794+00
5993ef3e-f508-4da6-8601-4a5dc36f2916	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	Vinay Patel	created project	projects	22222222-2222-2222-2222-222222222203	Austin Data Center	{}	2026-05-24 06:00:30.514794+00
77c6ee65-18ad-4959-9c78-a6acd04ecf0b	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	Linda Chen	created NCR from failed inspection	ncr_reports	318247d6-5836-42c1-925c-9edc6f03798c	NCR-0001	{"inspection_type": "paint"}	2026-05-24 09:00:44.887844+00
6bd1bbce-e729-46db-a083-caa5e561e84a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	Linda Chen	created paint inspections	paint_inspections	318247d6-5836-42c1-925c-9edc6f03798c	PI-0001	\N	2026-05-24 09:00:44.895372+00
b71a44ee-25f4-442c-820b-7ed8b9bc91f9	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	Vinay Patel	created projects	projects	34e14b3f-27ac-4c8a-9bec-000589e8a230	E2E Test	\N	2026-05-24 09:09:55.60489+00
dcc1cdcf-3cb8-4390-8191-e4ce9e542239	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	Linda Chen	created NCR from failed inspection	ncr_reports	67da7414-61a0-4468-b877-76c32ff2f06c	NCR-0002	{"inspection_type": "paint"}	2026-05-24 11:32:24.485833+00
4ecba0f1-e978-423c-b4e7-25805b6e3f55	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	Linda Chen	created paint inspections	paint_inspections	67da7414-61a0-4468-b877-76c32ff2f06c	PI-0002	\N	2026-05-24 11:32:24.503123+00
20acdb4b-a68c-47b3-ac45-7a6388f80679	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	Linda Chen	created NCR from failed inspection	ncr_reports	eeeeeeee-eeee-eeee-eeee-000000000438	NCR-0003	{"inspection_type": "weld"}	2026-05-24 12:11:42.190314+00
c1462568-d3d7-4d6e-bdc8-566354ee7ffb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	Linda Chen	created NCR from failed inspection	ncr_reports	dddddddd-dddd-dddd-dddd-000000000441	NCR-0004	{"inspection_type": "paint"}	2026-05-24 12:11:42.190314+00
1144d320-febb-4efe-859f-f070ca6e9c17	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	Linda Chen	created NCR from failed inspection	ncr_reports	dddddddd-dddd-dddd-dddd-000000000440	NCR-0005	{"inspection_type": "paint"}	2026-05-24 12:11:42.190314+00
a6fbe397-5562-447b-bbf8-d0dce2e4ab55	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	Linda Chen	created NCR from failed inspection	ncr_reports	dddddddd-dddd-dddd-dddd-000000000439	NCR-0006	{"inspection_type": "paint"}	2026-05-24 12:11:42.190314+00
2f61b5db-d4db-4d44-ade2-baacd1315cd2	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111103	David Park	submitted estimate	estimates	\N	EST-2026-041	{"total": 612000}	2026-05-24 10:11:42.190314+00
3d3391e8-6f0a-4d01-9133-32fa2dc8a455	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111107	Roberto Torres	uploaded photo	parts	\N	HSS6×6-0312	{"category": "inspection"}	2026-05-24 12:10:42.190314+00
a7c1b4d8-d6dc-4f78-a843-ece14c0224c7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	Linda Chen	failed paint inspection	paint_inspections	\N	PI-0440	{"result": "fail"}	2026-05-24 11:51:42.190314+00
1dc44bb9-d1f0-4833-865d-15978ae9719e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111104	Marcus Johnson	opened AISC hold	aisc_checklist	\N	W14x82 column QC review	{}	2026-05-24 12:08:42.190314+00
d9e57dbc-225e-4869-9900-e247b84a443e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	Vinay Patel	generated	shipping_tickets	\N	Load L-0041	{}	2026-05-24 12:03:42.190314+00
b75e7cd0-176a-470e-9161-3c9fb6971a34	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	Sarah Mitchell	submitted change order	change_orders	\N	CO-041	{"amount": 14800}	2026-05-24 11:26:42.190314+00
e4f77b12-f12c-479e-823f-30838436dcaa	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	Vinay Patel	created projects	projects	6be7ba57-5d35-4217-9e36-1ba381d9e306	Manti Project	\N	2026-05-24 12:22:41.83763+00
b50b5e36-016d-4b3f-9273-b404deab688f	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	Vinay Patel	updated parts	parts	e502bb60-e1fe-4249-8a34-7421b1a38684	PT-2222-012	\N	2026-05-24 12:30:33.868906+00
22d6c84a-5dd6-4907-8d6f-b65c302389d4	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	Vinay Patel	updated parts	parts	7887ac5f-6025-4653-b2fa-6dfd9609154c	PT-2222-006	\N	2026-05-24 12:30:41.428331+00
1ef836ce-047d-41f7-b3f4-8a4637d29cc3	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	Vinay Patel	updated parts	parts	6e7810a1-afac-404f-9700-b1c77ad5000d	AUTO-0001-HSS6x6x1/2	\N	2026-05-24 12:31:13.995225+00
4c89b02d-a93b-4b9a-a493-7e12542f8a7c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	Vinay Patel	converted estimate to project	projects	b0e92580-f157-47fb-8fc5-e3799b632c81	Houston Warehouse	\N	2026-05-24 12:32:48.096227+00
\.


--
-- Data for Name: ai_chat_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."ai_chat_history" ("id", "company_id", "user_id", "session_id", "role", "message", "metadata", "created_at") FROM stdin;
\.


--
-- Data for Name: ai_insights; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."ai_insights" ("id", "company_id", "insight_type", "priority", "title", "description", "suggested_action", "entity_type", "entity_id", "is_resolved", "resolved_at", "resolved_by", "created_at") FROM stdin;
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."projects" ("id", "company_id", "name", "number", "gc_name", "gc_contact", "gc_phone", "contract_value", "contract_type", "est_tonnage", "status", "pm_id", "start_date", "deadline", "description", "color", "is_archived", "created_by", "created_at", "updated_at") FROM stdin;
22222222-2222-2222-2222-222222222201	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	Dallas Skyline Tower	PRJ-2026-0001	Turner Construction	\N	\N	612000.00	Lump Sum	320.00	active	11111111-1111-1111-1111-111111111102	2026-02-01	2026-06-30	14-story commercial tower — structural steel and misc metals	#4F46E5	f	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
22222222-2222-2222-2222-222222222202	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	Houston Refinery Exp.	PRJ-2026-0002	Bechtel Corp	\N	\N	378000.00	GMP	195.00	active	11111111-1111-1111-1111-111111111102	2026-03-15	2026-09-15	Process equipment framing and structural expansion	#2563EB	f	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
22222222-2222-2222-2222-222222222203	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	Austin Data Center	PRJ-2026-0003	Apple Inc	\N	\N	824000.00	Lump Sum	410.00	active	11111111-1111-1111-1111-111111111102	2026-04-01	2026-12-01	Data center structural frame with galvanized exterior HSS	#7C3AED	f	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
22222222-2222-2222-2222-222222222204	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	San Antonio Bridge	PRJ-2026-0004	TXDOT	\N	\N	1240000.00	Unit Price	580.00	active	11111111-1111-1111-1111-111111111102	2026-01-10	2027-03-30	Pedestrian bridge superstructure with galvanized handrails	#0D9488	f	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
34e14b3f-27ac-4c8a-9bec-000589e8a230	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	E2E Test	PRJ-2026-0001	Test	\N	\N	50000.00	\N	\N	active	\N	\N	\N	\N	\N	f	\N	2026-05-24 09:09:55.597893+00	2026-05-24 09:09:55.597893+00
6be7ba57-5d35-4217-9e36-1ba381d9e306	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	Manti Project	PRJ-2026-2405	Manti's Company	\N	\N	10000.00	\N	\N	active	\N	\N	2026-05-25	\N	\N	f	\N	2026-05-24 12:22:41.81775+00	2026-05-24 12:22:41.81775+00
b0e92580-f157-47fb-8fc5-e3799b632c81	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	Houston Warehouse	PRJ-2026-0005	Procon LLC	\N	\N	378000.00	\N	88.00	active	\N	\N	\N	\N	\N	f	11111111-1111-1111-1111-111111111101	2026-05-24 12:32:48.087991+00	2026-05-24 12:32:48.087991+00
\.


--
-- Data for Name: aisc_checklist; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."aisc_checklist" ("id", "company_id", "project_id", "section_ref", "item_text", "category", "status", "assigned_to", "notes", "cleared_at", "cleared_by", "sort_order", "created_at", "updated_at") FROM stdin;
2c80603f-005e-49be-b432-3f22551d5bdc	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§6.1	Mill test reports received and verified	Materials	open	\N	\N	\N	\N	1	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
c36d7d59-d7fc-4eca-8dc3-da5ba572d8c5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§6.1	Material grade matches contract specification	Materials	open	\N	\N	\N	\N	2	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
62234396-7e7c-43e5-8438-ff02ad5b04b9	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§6.2	Heat numbers traceable to all members	Materials	open	\N	\N	\N	\N	3	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
b8963d75-2c72-4519-b213-3ee48190e6ca	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§6.3	Bolts conform to A325/A490 with proper markings	Materials	open	\N	\N	\N	\N	4	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
b16d48f8-f9a1-492a-9cb2-fb5b3ccbdfca	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§5.1	Cutting tolerances verified per §5.1	Fabrication	open	\N	\N	\N	\N	5	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
8aafbec8-a219-4813-b11a-d16f1513cc1c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§5.2	Drilling and reaming tolerances per §5.2	Fabrication	open	\N	\N	\N	\N	6	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
5fbbde01-48f3-49d2-87d0-0af0c78ec72f	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§5.3	Bend radii and cold-bend ratios per §5.3	Fabrication	open	\N	\N	\N	\N	7	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
7c51325b-ad25-44d7-b409-8fbcd5b83c27	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§6.4	WPS approved and on file	Welding	open	\N	\N	\N	\N	8	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
f7a5193a-3b6b-4d39-b8e6-702c7d4484c9	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§6.4	Welder qualification records current	Welding	open	\N	\N	\N	\N	9	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
a77afbe5-6f15-4cae-a8cb-93fa2e47452e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§6.5	Weld VT/UT/MT/PT per applicable AWS D1.1	Welding	open	\N	\N	\N	\N	10	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
0a0a0d09-4ca5-4893-96e8-44743f33ef2c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§6.5	CWI inspector certification valid	Welding	open	\N	\N	\N	\N	11	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
c0ac985c-4883-4ae6-a8d2-613adc397bac	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§7.1	Bolt installation method verified (turn-of-nut/torque)	Connections	open	\N	\N	\N	\N	12	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
a0d68e85-3445-4ecc-80ba-01834a1d9732	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§7.2	Faying surfaces prepared per slip-critical class	Connections	open	\N	\N	\N	\N	13	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
983efe05-180c-4a42-8f33-2bd67f0d1bee	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§7.3	Pretensioned bolts verified with Skidmore	Connections	open	\N	\N	\N	\N	14	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
c3fc0240-5850-4cf2-bead-b13d04709c47	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§8.1	Erection drawings reviewed and field-marked	Erection	open	\N	\N	\N	\N	15	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
511477db-20d1-49c1-9386-881214103512	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§8.2	Plumb, level and alignment within tolerance	Erection	open	\N	\N	\N	\N	16	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
35b155dc-a47a-45b6-a76d-c6ad575bff5a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§8.3	Anchor rod survey verified pre-erection	Erection	open	\N	\N	\N	\N	17	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
16ba0dc8-cec0-456a-820a-26999648d313	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§8.4	Temporary bracing per erector engineer	Erection	open	\N	\N	\N	\N	18	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
a4669383-8876-4be2-9990-712283a87149	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§9.1	Surface prep per SSPC class verified	Coatings	open	\N	\N	\N	\N	19	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
bbad4ac7-2989-410a-a2ad-f98697ffdfb8	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§9.2	Primer DFT meets project specification	Coatings	open	\N	\N	\N	\N	20	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
422a1e1e-56ac-41c8-9401-018987612f92	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§9.3	Topcoat DFT and total DFT within tolerance	Coatings	open	\N	\N	\N	\N	21	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
3264f44f-2cf9-4cc3-90fd-6b9dab9fad29	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§9.4	Galvanized coating thickness per ASTM A123	Coatings	open	\N	\N	\N	\N	22	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
ebd53757-5a41-4f2b-b7c6-0b6234091df8	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§10.1	Inspection reports submitted weekly	Documentation	open	\N	\N	\N	\N	23	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
17caedc9-9e74-4cb9-b4fb-a75116e17137	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	§10.2	Non-conformance reports closed before shipment	Documentation	open	\N	\N	\N	\N	24	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
\.


--
-- Data for Name: assemblies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."assemblies" ("id", "company_id", "project_id", "assembly_mark", "description", "total_weight", "total_parts", "completed_parts", "status", "created_at", "updated_at") FROM stdin;
deeac925-047b-45d6-ae8d-87b52d8ff4e6	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	A-205	Lvl 2 girder	8200.00	4	4	complete	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
55555555-5555-5555-5555-000000000003	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	MH-001	Stair stringer assembly — Stair 1	1240.00	14	8	in_progress	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
55555555-5555-5555-5555-000000000004	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	F-011	HSS4×4 brace assembly — Phase 2	880.00	6	2	in_progress	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
bfa7864b-4790-4198-9ddc-29bf71cbe67f	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	B-108	X-brace truss	4100.00	16	8	in_progress	2026-05-24 09:00:30.514794+00	2026-05-24 12:11:42.190314+00
55555555-5555-5555-5555-000000000001	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	C-041	W8×31 beam assembly — Bay 3	3200.00	15	8	in_progress	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
55555555-5555-5555-5555-000000000002	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	D-017	L4×4 clip angle assembly	580.00	15	7	complete	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
90bb0070-631a-4c22-8fa1-644bace7f32c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	A-204	NE Corner column assembly	12500.00	16	7	in_progress	2026-05-24 09:00:30.514794+00	2026-05-24 12:11:42.190314+00
\.


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."audit_log" ("id", "company_id", "user_id", "action", "table_name", "record_id", "old_values", "new_values", "ip_address", "user_agent", "created_at") FROM stdin;
980d84aa-fbe3-49f9-b3cf-dd78fa5841c6	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	insert	paint_inspections	318247d6-5836-42c1-925c-9edc6f03798c	\N	{"id": "318247d6-5836-42c1-925c-9edc6f03798c", "notes": null, "result": "fail", "part_id": "38d794bb-c537-4e0a-a149-dffa51682223", "total_dft": 3, "company_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "created_at": "2026-05-24T09:00:44.887844+00:00", "primer_dft": 2, "project_id": "22222222-2222-2222-2222-222222222201", "updated_at": "2026-05-24T09:00:44.887844+00:00", "insp_number": "PI-0001", "topcoat_dft": 1, "ambient_temp": null, "humidity_pct": null, "inspector_id": null, "required_min": 5, "surface_prep": "SSPC-SP10", "inspector_name": "Linda Chen", "inspection_date": "2026-05-24"}	172.67.135.174	curl/8.6.0	2026-05-24 09:00:44.89276+00
89a17dbe-af4b-46e2-91be-ed0bf135a9af	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	insert	projects	34e14b3f-27ac-4c8a-9bec-000589e8a230	\N	{"id": "34e14b3f-27ac-4c8a-9bec-000589e8a230", "name": "E2E Test", "color": null, "pm_id": null, "number": "PRJ-2026-0001", "status": "active", "gc_name": "Test", "deadline": null, "gc_phone": null, "company_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "created_at": "2026-05-24T09:09:55.597893+00:00", "created_by": null, "gc_contact": null, "start_date": null, "updated_at": "2026-05-24T09:09:55.597893+00:00", "description": null, "est_tonnage": null, "is_archived": false, "contract_type": null, "contract_value": 50000}	172.67.135.174	node	2026-05-24 09:09:55.601939+00
957d6db2-81fb-42d4-96e7-abbaeed05120	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	insert	paint_inspections	67da7414-61a0-4468-b877-76c32ff2f06c	\N	{"id": "67da7414-61a0-4468-b877-76c32ff2f06c", "notes": null, "result": "fail", "part_id": "ed47697e-e648-499a-955c-5bb1f9f0d51f", "total_dft": 3, "company_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "created_at": "2026-05-24T11:32:24.485833+00:00", "primer_dft": 1.2, "project_id": "34e14b3f-27ac-4c8a-9bec-000589e8a230", "updated_at": "2026-05-24T11:32:24.485833+00:00", "insp_number": "PI-0002", "topcoat_dft": 1.8, "ambient_temp": null, "humidity_pct": null, "inspector_id": null, "required_min": 4, "surface_prep": "SP6", "inspector_name": "Linda Chen", "inspection_date": "2026-05-24"}	162.247.241.2	curl/8.6.0	2026-05-24 11:32:24.497296+00
45d2d35a-7bbc-415d-9917-580b4cb741c8	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	insert	projects	6be7ba57-5d35-4217-9e36-1ba381d9e306	\N	{"id": "6be7ba57-5d35-4217-9e36-1ba381d9e306", "name": "Manti Project", "color": null, "pm_id": null, "number": "PRJ-2026-2405", "status": "active", "gc_name": "Manti's Company", "deadline": "2026-05-25", "gc_phone": null, "company_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "created_at": "2026-05-24T12:22:41.81775+00:00", "created_by": null, "gc_contact": null, "start_date": null, "updated_at": "2026-05-24T12:22:41.81775+00:00", "description": null, "est_tonnage": null, "is_archived": false, "contract_type": null, "contract_value": 10000}	162.247.243.32	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	2026-05-24 12:22:41.828084+00
093a2767-72d5-45fd-8b03-ea7e106b9b1f	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	update	parts	e502bb60-e1fe-4249-8a34-7421b1a38684	{"id": "e502bb60-e1fe-4249-8a34-7421b1a38684", "grade": "A992", "notes": null, "phase": "P1", "length": 20, "status": "not_started", "weight": 672, "profile": "W18x46", "quantity": 1, "part_mark": "PT-2222-012", "company_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "created_at": "2026-05-24T12:11:42.190314+00:00", "created_by": null, "drawing_id": null, "project_id": "22222222-2222-2222-2222-222222222204", "updated_at": "2026-05-24T12:11:42.190314+00:00", "heat_number": null, "assembly_mark": "A-034", "assigned_user_id": null}	{"id": "e502bb60-e1fe-4249-8a34-7421b1a38684", "grade": "A992", "notes": null, "phase": "P1", "length": 20, "status": "not_started", "weight": 672, "profile": "W18x46", "quantity": 1, "part_mark": "PT-2222-012", "company_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "created_at": "2026-05-24T12:11:42.190314+00:00", "created_by": null, "drawing_id": null, "project_id": "6be7ba57-5d35-4217-9e36-1ba381d9e306", "updated_at": "2026-05-24T12:30:33.861049+00:00", "heat_number": null, "assembly_mark": "A-034", "assigned_user_id": null}	162.247.243.32	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	2026-05-24 12:30:33.865361+00
e64eb36e-d6d4-4354-b0e2-010907f6f1a8	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	update	parts	7887ac5f-6025-4653-b2fa-6dfd9609154c	{"id": "7887ac5f-6025-4653-b2fa-6dfd9609154c", "grade": "A992", "notes": null, "phase": "P1", "length": 19, "status": "in_progress", "weight": 606, "profile": "W18x46", "quantity": 1, "part_mark": "PT-2222-006", "company_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "created_at": "2026-05-24T12:11:42.190314+00:00", "created_by": null, "drawing_id": null, "project_id": "22222222-2222-2222-2222-222222222204", "updated_at": "2026-05-24T12:11:42.190314+00:00", "heat_number": null, "assembly_mark": "A-042", "assigned_user_id": null}	{"id": "7887ac5f-6025-4653-b2fa-6dfd9609154c", "grade": "A992", "notes": null, "phase": "P1", "length": 19, "status": "in_progress", "weight": 606, "profile": "W18x46", "quantity": 1, "part_mark": "PT-2222-006", "company_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "created_at": "2026-05-24T12:11:42.190314+00:00", "created_by": null, "drawing_id": null, "project_id": "6be7ba57-5d35-4217-9e36-1ba381d9e306", "updated_at": "2026-05-24T12:30:41.421825+00:00", "heat_number": null, "assembly_mark": "A-042", "assigned_user_id": null}	162.247.243.32	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	2026-05-24 12:30:41.426067+00
7aff98d4-00f6-44d4-9bf8-fd01c9e05cf0	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	update	parts	6e7810a1-afac-404f-9700-b1c77ad5000d	{"id": "6e7810a1-afac-404f-9700-b1c77ad5000d", "grade": "A500-C", "notes": null, "phase": "P1", "length": 14, "status": "complete", "weight": 892, "profile": "HSS6x6x1/2", "quantity": 1, "part_mark": "AUTO-0001-HSS6x6x1/2", "company_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "created_at": "2026-05-24T12:11:42.190314+00:00", "created_by": null, "drawing_id": "33333333-3333-3333-3333-333333333302", "project_id": "22222222-2222-2222-2222-222222222201", "updated_at": "2026-05-24T12:11:42.190314+00:00", "heat_number": "HT-23846", "assembly_mark": "B-108", "assigned_user_id": null}	{"id": "6e7810a1-afac-404f-9700-b1c77ad5000d", "grade": "A500-C", "notes": null, "phase": "P1", "length": 14, "status": "complete", "weight": 892, "profile": "HSS6x6x1/2", "quantity": 1, "part_mark": "AUTO-0001-HSS6x6x1/2", "company_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "created_at": "2026-05-24T12:11:42.190314+00:00", "created_by": null, "drawing_id": "33333333-3333-3333-3333-333333333302", "project_id": "6be7ba57-5d35-4217-9e36-1ba381d9e306", "updated_at": "2026-05-24T12:31:13.986436+00:00", "heat_number": "HT-23846", "assembly_mark": "B-108", "assigned_user_id": null}	162.247.243.32	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	2026-05-24 12:31:13.992764+00
80a9a31a-dbb6-4219-82a1-eb10d5518e66	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	rpc	projects	b0e92580-f157-47fb-8fc5-e3799b632c81	\N	{"id": "b0e92580-f157-47fb-8fc5-e3799b632c81", "name": "Houston Warehouse", "color": null, "pm_id": null, "number": "PRJ-2026-0005", "status": "active", "gc_name": "Procon LLC", "deadline": null, "gc_phone": null, "company_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "created_at": "2026-05-24T12:32:48.087991+00:00", "created_by": "11111111-1111-1111-1111-111111111101", "gc_contact": null, "start_date": null, "updated_at": "2026-05-24T12:32:48.087991+00:00", "description": null, "est_tonnage": 88, "is_archived": false, "contract_type": null, "contract_value": 378000}	162.247.243.32	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	2026-05-24 12:32:48.094169+00
\.


--
-- Data for Name: billing_applications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."billing_applications" ("id", "company_id", "project_id", "application_number", "period_to", "original_contract", "change_orders_total", "completed_to_date", "materials_stored", "retainage_percent", "retainage_withheld", "previous_billed", "amount_due", "pct_complete", "status", "pdf_url", "notes", "submitted_at", "certified_at", "created_by", "created_at", "updated_at") FROM stdin;
bbbbbbbb-bbbb-bbbb-bbbb-000000000001	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	1	2026-01-31	612000.00	0.00	122400.00	12000.00	10.00	12240.00	0.00	110160.00	20.00	certified	\N	\N	2026-02-23 12:11:42.190314+00	2026-03-05 12:11:42.190314+00	11111111-1111-1111-1111-111111111106	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
bbbbbbbb-bbbb-bbbb-bbbb-000000000002	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	2	2026-02-28	612000.00	8400.00	269000.00	14000.00	10.00	26900.00	110160.00	130940.00	44.00	certified	\N	\N	2026-03-25 12:11:42.190314+00	2026-04-04 12:11:42.190314+00	11111111-1111-1111-1111-111111111106	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
bbbbbbbb-bbbb-bbbb-bbbb-000000000003	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	3	2026-03-31	612000.00	8400.00	441000.00	18000.00	10.00	44100.00	240900.00	155400.00	72.00	submitted	\N	\N	2026-05-20 12:11:42.190314+00	\N	11111111-1111-1111-1111-111111111106	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
\.


--
-- Data for Name: certifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."certifications" ("id", "company_id", "cert_type", "holder_name", "cert_number", "issue_date", "expiry_date", "alert_days", "status", "file_url", "created_at", "updated_at") FROM stdin;
14b3d555-8e62-494e-a585-8de7fb88baa5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	CWI	Linda Chen	AWS-CWI-23145	2023-08-15	2026-06-11	30	active	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
f6f30dab-030d-4f74-9223-813e034d710a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	AWS D1.1 Welder	Roberto Torres	WPS-3G-882	2024-05-10	2026-08-22	30	active	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
932c0456-58fa-4c06-8d89-5c339f3a60d5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	Crane Operator	Marcus Johnson	NCCCO-CC-9921	2022-11-01	2026-06-17	30	active	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
37fc1f03-19a8-4c10-8484-7a7b39cb4d80	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	AISC Certified Fab Shop	NOVUSsteel Demo Shop	AISC-1245	2024-01-01	2027-01-24	60	active	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
bc809964-3467-4a4e-bac7-68caf8995f7a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	AWS Welder	A. Garcia	WC-7732	2025-04-15	2026-06-16	30	active	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
21767b85-6639-4475-ad8d-0a7c393413d5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	AWS CWI	M. Kowalski	SCWI-4821	2022-03-01	2025-03-01	60	active	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
2d0ffa9a-e821-46fb-92c5-c876eaac5776	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	AWS Welder	R. Torres	WC-8841	2025-06-01	2026-06-01	60	active	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
179b84c6-a29e-489f-aeac-cc83db42b67f	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	DOT Carrier	J&L Trucking	TX-DOT-2841	2026-01-01	2026-12-31	30	active	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
5b78ce4c-f06d-4d51-95e4-1b20ef645ad5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	Crane / Rigging	Atlas Crane Co	CRANE-4411	2026-02-01	2026-06-02	30	active	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
343d8370-da64-4d4e-ab75-1a14bab6e187	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	AWS CWI	D. Nguyen	CWI-2841	2024-01-05	2027-01-05	60	active	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
fb29e7b6-1625-46e9-9c6b-8ed6a11fef0c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	SSPC Painting Insp.	J. Reyes	PCI-1141	2024-09-01	2026-09-01	60	active	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
\.


--
-- Data for Name: change_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."change_orders" ("id", "company_id", "project_id", "co_number", "description", "amount", "status", "drawing_rev", "submitted_by", "approved_by", "approved_at", "notes", "created_at", "updated_at") FROM stdin;
77777777-7777-7777-7777-000000000041	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	CO-041	Add (8) W6×15 beams — Level 12 grid extension	14800.00	pending	Rev D	11111111-1111-1111-1111-111111111102	\N	\N	Turner GC requested grid extension	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
77777777-7777-7777-7777-000000000040	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	CO-040	Revise (12) base plate details — add gusset	8400.00	approved	Rev C	11111111-1111-1111-1111-111111111102	11111111-1111-1111-1111-111111111101	2026-05-20 12:11:42.190314+00	EOR requested for seismic adequacy	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
77777777-7777-7777-7777-000000000039	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	CO-039	Additional (24) misc angle clips	3200.00	approved	Rev B	11111111-1111-1111-1111-111111111102	11111111-1111-1111-1111-111111111101	2026-05-14 12:11:42.190314+00	Billed App. #3	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
77777777-7777-7777-7777-000000000038	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	CO-038	Galvanize all exterior HSS — spec change	21600.00	pending	Rev A	11111111-1111-1111-1111-111111111102	\N	\N	Apple owner's rep requested galv	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
\.


--
-- Data for Name: cut_plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."cut_plans" ("id", "company_id", "project_id", "profile", "stock_length", "kerf", "min_remnant", "cuts", "waste_percentage", "total_bars", "total_yield_pct", "parameters_json", "generated_at", "created_by", "created_at", "updated_at") FROM stdin;
7c000000-0000-0000-0000-000000000001	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	W14x82	480.000	0.125	6.000	[{"cuts": [{"mark": "AUTO-0001", "length": 244}, {"mark": "AUTO-0007", "length": 234}], "waste": 1.875, "remnant": 1.875, "bar_index": 1, "used_length": 478.125}, {"cuts": [{"mark": "AUTO-0013", "length": 244}, {"mark": "AUTO-0019", "length": 234}], "waste": 1.875, "remnant": 1.875, "bar_index": 2, "used_length": 478.125}, {"cuts": [{"mark": "AUTO-0025", "length": 244}, {"mark": "AUTO-0031", "length": 120}], "waste": 0, "remnant": 115.875, "bar_index": 3, "used_length": 364.125}]	3.27	3	96.73	{"input_cuts": [{"qty": 3, "mark": "col", "length": 244}, {"qty": 2, "mark": "col", "length": 234}, {"qty": 1, "mark": "infill", "length": 120}]}	2026-05-24 12:11:42.190314+00	11111111-1111-1111-1111-111111111104	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
\.


--
-- Data for Name: daily_production_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."daily_production_log" ("id", "company_id", "project_id", "log_date", "shift", "station", "operators", "parts_completed", "hours_worked", "operation_type", "notes", "created_by", "created_at", "updated_at") FROM stdin;
f9392080-5bac-4eff-a16d-306eb1ee61a3	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	2026-05-20	Day	Bay 1 / Cutting	{"Roberto Torres","Marcus Johnson"}	88	16.00	Cutting	Plasma table running smoothly	11111111-1111-1111-1111-111111111104	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
95229b65-3e7a-47b3-9c9d-8b52fda4d2cb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	2026-05-21	Day	Bay 2 / Welding	{"Roberto Torres"}	102	16.00	Welding	4 weld inspections passed	11111111-1111-1111-1111-111111111104	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
fcc9d50f-6f08-45d9-9df2-5423e3c3570e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	2026-05-22	Day	Paint Booth	{"Marcus Johnson"}	91	14.00	Painting	DFT readings in spec	11111111-1111-1111-1111-111111111104	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
59a5a03c-84c5-4cf0-b8d8-0df506602402	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	2026-05-23	Day	Bay 1 / Cutting	{"Roberto Torres","Marcus Johnson"}	118	16.00	Cutting	Best day this quarter	11111111-1111-1111-1111-111111111104	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
62d734b2-e184-4f2b-b421-9a9ad8debdb8	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	2026-05-24	Day	Bay 2 / Welding	{"Roberto Torres"}	73	10.00	Welding	Started late — crane maintenance	11111111-1111-1111-1111-111111111104	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
\.


--
-- Data for Name: drawings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."drawings" ("id", "company_id", "project_id", "drawing_number", "revision", "title", "type", "status", "current_revision", "date_issued", "approved_by", "file_url", "parts_count", "created_at", "updated_at") FROM stdin;
33333333-3333-3333-3333-333333333301	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	DS-101	D	Tower frame lvl 1-4	shop	approved	t	2026-02-15	11111111-1111-1111-1111-111111111102	\N	0	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
33333333-3333-3333-3333-333333333302	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	DS-102	C	Tower frame lvl 5-9	shop	approved	t	2026-02-20	11111111-1111-1111-1111-111111111102	\N	0	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
33333333-3333-3333-3333-333333333303	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	DS-104	D	Bracing detail	shop	approved	t	2026-03-01	11111111-1111-1111-1111-111111111102	\N	0	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
33333333-3333-3333-3333-333333333304	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	HR-201	B	Refinery framing N	shop	released	t	2026-03-20	11111111-1111-1111-1111-111111111102	\N	0	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
33333333-3333-3333-3333-333333333305	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	DS-102	B	HSS bracing — original (SUPERSEDED)	shop	superseded	f	2026-04-24	11111111-1111-1111-1111-111111111102	\N	0	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
33333333-3333-3333-3333-333333333306	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	DM-001	B	Misc metals — handrail, stairs	connection	approved	t	2026-05-16	11111111-1111-1111-1111-111111111102	\N	0	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
33333333-3333-3333-3333-333333333307	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	AD-001	A	Austin DC frame — Phase 1 columns	shop	in_progress	t	2026-05-20	11111111-1111-1111-1111-111111111102	\N	0	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
\.


--
-- Data for Name: parts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."parts" ("id", "company_id", "project_id", "part_mark", "assembly_mark", "profile", "grade", "length", "weight", "quantity", "status", "phase", "heat_number", "drawing_id", "assigned_user_id", "notes", "created_by", "created_at", "updated_at") FROM stdin;
38d794bb-c537-4e0a-a149-dffa51682223	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	W14x82-1044	A-204	W14x82	A992	24.500	2009.00	1	in_progress	P2	HT-23845	33333333-3333-3333-3333-333333333303	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
ed47697e-e648-499a-955c-5bb1f9f0d51f	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	HSS6x6-0312	B-108	HSS6x6x3/8	A500-C	18.000	540.00	1	in_progress	P2	HT-23846	33333333-3333-3333-3333-333333333303	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
75dff4fa-9c06-402c-a6df-fcd7f475cfb8	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	W12x65-2104	A-205	W12x65	A992	22.000	1430.00	1	complete	P1	HT-23845	33333333-3333-3333-3333-333333333301	\N	\N	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
e9c0dd7e-27c3-46a7-bcf9-08c76ed0adae	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	L4x4x1/2-0801	C-110	L4x4x1/2	A36	12.000	145.00	1	not_started	P1	\N	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
3f4f061d-1b72-4f76-a3a3-c89d84bf3570	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	W18x46-3001	D-201	W18x46	A992	28.000	1288.00	1	shipped	P1	HT-23800	33333333-3333-3333-3333-333333333304	\N	\N	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
8a14e4dc-1bf8-48d4-bf75-bc49c726593e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	C10x15.3-4001	E-301	C10x15.3	A36	20.000	306.00	1	in_progress	P1	HT-23900	\N	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
0cb4b1c7-b130-4790-ba3c-a57b073b191c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0002-W8x31	C-041	W8x31	A992	20.330	882.00	1	complete	P1	HT-23900	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
52bc823d-5ac0-4427-8104-2e655a64154a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0003-W24x68	D-017	W24x68	A992	20.330	1632.00	1	complete	P1	HT-23800	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
ba1a33e6-ebc2-4b0b-8215-ac2b403d39a1	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0004-L4x4x3/8	A-204	L4x4x3/8	A36	8.000	194.00	1	complete	P1	HT-23845	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
253304e4-1006-439d-8d91-73523fe7ae85	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0005-W14x82	B-108	W14x82	A992	20.330	1672.00	1	complete	P1	HT-23846	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
244b84cf-e1f1-4bfd-8a46-e838c7d99363	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0006-HSS6x6x1/2	C-041	HSS6x6x1/2	A500-C	14.000	892.00	1	complete	P1	HT-23900	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
3504df22-e647-4061-b176-2d4fa62abcf3	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0007-W8x31	D-017	W8x31	A992	20.330	882.00	1	complete	P1	HT-23800	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
50c879d6-da94-4171-bf0f-40673dad3abd	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0008-W24x68	A-204	W24x68	A992	20.330	1632.00	1	complete	P1	HT-23845	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
fe830770-33ae-42ad-be27-d43e010ec5b6	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0009-L4x4x3/8	B-108	L4x4x3/8	A36	8.000	194.00	1	complete	P1	HT-23846	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
ec5ea828-ceb1-459f-a9da-d0fd481e2c41	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0010-W14x82	C-041	W14x82	A992	20.330	1672.00	1	complete	P1	HT-23900	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
728181ab-9919-46f0-bbeb-f38e7de16dc5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0011-HSS6x6x1/2	D-017	HSS6x6x1/2	A500-C	14.000	892.00	1	complete	P1	HT-23800	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
99cde58a-d7be-4286-abb2-2252e6eb821f	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0012-W8x31	A-204	W8x31	A992	20.330	882.00	1	complete	P1	HT-23845	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
63d312e2-661a-4e38-abbb-1fa2f880108a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0013-W24x68	B-108	W24x68	A992	20.330	1632.00	1	complete	P1	HT-23846	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
d39881a3-a9ae-4dfd-94c2-9924745eb94e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0014-L4x4x3/8	C-041	L4x4x3/8	A36	8.000	194.00	1	complete	P1	HT-23900	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
7903219e-4588-440f-bd34-67619ebbf1cc	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0015-W14x82	D-017	W14x82	A992	20.330	1672.00	1	complete	P1	HT-23800	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
14a77f3a-e2bb-4036-be05-8c257d436b33	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0016-HSS6x6x1/2	A-204	HSS6x6x1/2	A500-C	14.000	892.00	1	complete	P1	HT-23845	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
9e34086b-87b0-47c9-a0ac-7c68d1175ac7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0017-W8x31	B-108	W8x31	A992	20.330	882.00	1	complete	P1	HT-23846	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
a3ec47ca-0a21-435d-a2ac-0d4f7bc87907	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0018-W24x68	C-041	W24x68	A992	20.330	1632.00	1	complete	P1	HT-23900	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
a7b52ebf-4f01-4e42-90f8-4256682a9372	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0019-L4x4x3/8	D-017	L4x4x3/8	A36	8.000	194.00	1	complete	P1	HT-23800	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
993c7c26-3ba0-42e8-bb21-79f8160b7d45	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0020-W14x82	A-204	W14x82	A992	20.330	1672.00	1	complete	P1	HT-23845	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
bace7039-b7a6-42af-82c3-64de187b8406	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0021-HSS6x6x1/2	B-108	HSS6x6x1/2	A500-C	14.000	892.00	1	complete	P1	HT-23846	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
1511670a-c34c-4757-9b31-0230e50db616	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0022-W8x31	C-041	W8x31	A992	20.330	882.00	1	complete	P1	HT-23900	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
5fd6a559-b510-4e9c-8014-bf6feff881d1	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0023-W24x68	D-017	W24x68	A992	20.330	1632.00	1	complete	P1	HT-23800	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
74f00afa-2a66-41a6-a466-bdfd1e03323d	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0024-L4x4x3/8	A-204	L4x4x3/8	A36	8.000	194.00	1	complete	P1	HT-23845	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
2839138c-8f6f-4f79-a628-11df37d15b33	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0025-W14x82	B-108	W14x82	A992	20.330	1672.00	1	in_progress	P1	HT-23846	33333333-3333-3333-3333-333333333302	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
8ff3bb4c-dac2-4d3c-9000-4cb141b082ec	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0026-HSS6x6x1/2	C-041	HSS6x6x1/2	A500-C	14.000	892.00	1	in_progress	P1	HT-23900	33333333-3333-3333-3333-333333333303	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
d2b7091b-8d02-4f8a-b199-5c71b9835c33	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0027-W8x31	D-017	W8x31	A992	20.330	882.00	1	in_progress	P1	HT-23800	33333333-3333-3333-3333-333333333302	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
07239530-6a12-48f9-9a43-7599a53de510	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0028-W24x68	A-204	W24x68	A992	20.330	1632.00	1	in_progress	P1	HT-23845	33333333-3333-3333-3333-333333333303	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
1946968b-c085-4a24-b7eb-31247edb784b	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0029-L4x4x3/8	B-108	L4x4x3/8	A36	8.000	194.00	1	in_progress	P1	HT-23846	33333333-3333-3333-3333-333333333302	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
6496ca33-b604-4688-a655-43e463c957d1	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0030-W14x82	C-041	W14x82	A992	20.330	1672.00	1	in_progress	P1	HT-23900	33333333-3333-3333-3333-333333333303	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
63c6bcae-7b02-4036-a989-d0defa1c74d9	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0031-HSS6x6x1/2	D-017	HSS6x6x1/2	A500-C	14.000	892.00	1	in_progress	P2	HT-23800	33333333-3333-3333-3333-333333333302	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
975092bc-5365-4b6d-99f2-52bd508d852a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0032-W8x31	A-204	W8x31	A992	20.330	882.00	1	in_progress	P2	HT-23845	33333333-3333-3333-3333-333333333303	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
f77a298d-5058-4821-973c-bda1f7d8055a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0033-W24x68	B-108	W24x68	A992	20.330	1632.00	1	in_progress	P2	HT-23846	33333333-3333-3333-3333-333333333302	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
207ff999-8392-4f8c-ba65-8e5da08f8a52	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0034-L4x4x3/8	C-041	L4x4x3/8	A36	8.000	194.00	1	in_progress	P2	HT-23900	33333333-3333-3333-3333-333333333303	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
2f33c565-ab20-4dc0-9db9-8a3ea6f65a01	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0035-W14x82	D-017	W14x82	A992	20.330	1672.00	1	in_progress	P2	HT-23800	33333333-3333-3333-3333-333333333302	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
bd028516-c4e4-4858-a6fa-5c13bcb3f577	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0036-HSS6x6x1/2	A-204	HSS6x6x1/2	A500-C	14.000	892.00	1	in_progress	P2	HT-23845	33333333-3333-3333-3333-333333333303	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
d2833aeb-bc94-4d5a-80fa-f1b8cbe902a8	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0037-W8x31	B-108	W8x31	A992	20.330	882.00	1	not_started	P2	HT-23846	33333333-3333-3333-3333-333333333302	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
a255db2f-d246-44f3-83a6-57514ef2c01e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0038-W24x68	C-041	W24x68	A992	20.330	1632.00	1	not_started	P2	HT-23900	33333333-3333-3333-3333-333333333303	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
dc292105-a428-4dcb-b4d6-af0d9c04d0b7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0039-L4x4x3/8	D-017	L4x4x3/8	A36	8.000	194.00	1	not_started	P2	HT-23800	33333333-3333-3333-3333-333333333302	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
32150d45-1bb4-47d0-a0fc-6264f0cc4267	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0040-W14x82	A-204	W14x82	A992	20.330	1672.00	1	not_started	P2	HT-23845	33333333-3333-3333-3333-333333333303	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
12749b0f-7878-4563-8c97-3e70224aeaf9	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0041-HSS6x6x1/2	B-108	HSS6x6x1/2	A500-C	14.000	892.00	1	not_started	P2	HT-23846	33333333-3333-3333-3333-333333333302	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
8fe4a6c2-0ca0-4ef2-a3aa-3b19f89d9df6	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0042-W8x31	C-041	W8x31	A992	20.330	882.00	1	not_started	P2	HT-23900	33333333-3333-3333-3333-333333333303	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
956458b3-5514-45b4-882f-e4428e5424c0	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0043-W24x68	D-017	W24x68	A992	20.330	1632.00	1	not_started	P2	HT-23800	33333333-3333-3333-3333-333333333302	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
ecde915c-ede9-40b5-9767-01588a7c5796	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0044-L4x4x3/8	A-204	L4x4x3/8	A36	8.000	194.00	1	not_started	P2	HT-23845	33333333-3333-3333-3333-333333333303	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
6fdffd8c-4515-40b4-aacf-2dad7ba9f2f5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0045-W14x82	B-108	W14x82	A992	20.330	1672.00	1	not_started	P2	HT-23846	33333333-3333-3333-3333-333333333302	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
dc88999c-5731-4862-b09d-b9b897a2acea	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0046-HSS6x6x1/2	C-041	HSS6x6x1/2	A500-C	14.000	892.00	1	not_started	P2	HT-23900	33333333-3333-3333-3333-333333333303	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
b5537274-a72a-41a6-b899-7c3c3af40b9d	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0047-W8x31	D-017	W8x31	A992	20.330	882.00	1	not_started	P2	HT-23800	33333333-3333-3333-3333-333333333302	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
cb9f24a1-45f7-4318-83a2-1c97ae2868ad	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0048-W24x68	A-204	W24x68	A992	20.330	1632.00	1	not_started	P2	HT-23845	33333333-3333-3333-3333-333333333303	11111111-1111-1111-1111-111111111107	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
6b653028-08ce-4786-ab55-c76b0bd6f65e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0049-L4x4x3/8	B-108	L4x4x3/8	A36	8.000	194.00	1	shipped	P2	HT-23846	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
80aad411-a612-438e-9d7d-580543b77fce	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0050-W14x82	C-041	W14x82	A992	20.330	1672.00	1	shipped	P2	HT-23900	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
84b3b3a6-a910-4d0d-801e-8104c24eca2b	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0051-HSS6x6x1/2	D-017	HSS6x6x1/2	A500-C	14.000	892.00	1	shipped	P2	HT-23800	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
f1494906-38d8-456d-a1b3-762522c5b3c8	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0052-W8x31	A-204	W8x31	A992	20.330	882.00	1	shipped	P2	HT-23845	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
97436d4d-ece8-48f9-922e-db78c0fbd0cd	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0053-W24x68	B-108	W24x68	A992	20.330	1632.00	1	shipped	P2	HT-23846	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
cdae5c9b-996a-4cbf-89e3-b18ed72fb6eb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0054-L4x4x3/8	C-041	L4x4x3/8	A36	8.000	194.00	1	shipped	P2	HT-23900	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
98d2d7a5-fa81-4133-aec6-221334c95106	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0055-W14x82	D-017	W14x82	A992	20.330	1672.00	1	on_hold	P2	HT-23800	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
ca7dde77-1581-4c45-bfb2-df4a9b050568	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0056-HSS6x6x1/2	A-204	HSS6x6x1/2	A500-C	14.000	892.00	1	on_hold	P2	HT-23845	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
3537a341-1795-45d2-9085-48b495a7091a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0057-W8x31	B-108	W8x31	A992	20.330	882.00	1	on_hold	P2	HT-23846	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
6d6096b7-e692-490e-a260-dc08fa949a37	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0058-W24x68	C-041	W24x68	A992	20.330	1632.00	1	on_hold	P2	HT-23900	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
71c66997-ce55-4964-a49d-4db3df72d915	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0059-L4x4x3/8	D-017	L4x4x3/8	A36	8.000	194.00	1	on_hold	P2	HT-23800	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
edbe43aa-d906-4fe1-88a4-2733b9ee1856	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	AUTO-0060-W14x82	A-204	W14x82	A992	20.330	1672.00	1	on_hold	P2	HT-23845	33333333-3333-3333-3333-333333333303	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
0e82f729-3ac4-43e2-8326-2b97eeba6481	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	PT-2222-001	A-007	C12x20.7	A36	19.000	551.00	1	complete	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
cbd2fac7-633a-4258-92e5-0c194aa5783c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	PT-2222-002	A-014	PL1/2x12	A36	20.000	562.00	1	complete	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
648587ff-9172-4a55-b705-f056253b19f9	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	PT-2222-003	A-021	W18x46	A992	21.000	573.00	1	complete	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
f33c1a75-a222-460a-b229-bf9c210d7ff9	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	PT-2222-004	A-028	C12x20.7	A36	22.000	584.00	1	complete	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
c20a0529-2d54-457a-b48d-ed20845407bf	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	PT-2222-005	A-035	PL1/2x12	A36	18.000	595.00	1	in_progress	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
77158bc3-2ce0-45b0-8361-102f0eb0ce36	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	PT-2222-006	A-042	W18x46	A992	19.000	606.00	1	in_progress	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
8863a5b3-098b-4584-84eb-8f72b6fefb0e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	PT-2222-007	A-049	C12x20.7	A36	20.000	617.00	1	in_progress	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
0e1c342c-1ecf-4395-ae46-855f3e55c923	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	PT-2222-008	A-006	PL1/2x12	A36	21.000	628.00	1	in_progress	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
dded1b86-553c-41e4-8fcb-81e0eeeaec5b	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	PT-2222-009	A-013	W18x46	A992	22.000	639.00	1	in_progress	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
118c1cb7-8b08-465b-8158-9d361c862508	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	PT-2222-010	A-020	C12x20.7	A36	18.000	650.00	1	not_started	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
dc7726df-fc8a-4795-9a55-3da7c81fef31	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	PT-2222-011	A-027	PL1/2x12	A36	19.000	661.00	1	not_started	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
e2d7dc67-61dc-4464-82b1-5dbe460307b6	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	PT-2222-012	A-034	W18x46	A992	20.000	672.00	1	not_started	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
54d19179-4e0f-4799-b199-fe9fc641879e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	PT-2222-001	A-007	C12x20.7	A36	19.000	551.00	1	complete	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
aa284484-00d2-4668-ad69-91dba6a89fe1	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	PT-2222-002	A-014	PL1/2x12	A36	20.000	562.00	1	complete	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
18e78f64-b38c-4a9b-acd3-f29487dc1c83	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	PT-2222-003	A-021	W18x46	A992	21.000	573.00	1	complete	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
b9a24df2-a037-4b0a-bf93-55ee2d97652d	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	PT-2222-004	A-028	C12x20.7	A36	22.000	584.00	1	complete	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
ea6778f8-3d6e-4b8f-899a-2ec1e84bfd6e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	PT-2222-005	A-035	PL1/2x12	A36	18.000	595.00	1	in_progress	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
70abe392-266c-48ab-991b-915db9edf02f	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	PT-2222-006	A-042	W18x46	A992	19.000	606.00	1	in_progress	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
34422583-48c0-448a-a102-f01ea5e14fe2	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	PT-2222-007	A-049	C12x20.7	A36	20.000	617.00	1	in_progress	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
c2a9183f-651d-42bc-b7cc-962e3b526545	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	PT-2222-008	A-006	PL1/2x12	A36	21.000	628.00	1	in_progress	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
267394f6-2f5a-446c-af6b-f3a4fa4c8919	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	PT-2222-009	A-013	W18x46	A992	22.000	639.00	1	in_progress	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
f9ab657d-7528-4c6c-835a-c8072e220807	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	PT-2222-010	A-020	C12x20.7	A36	18.000	650.00	1	not_started	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
c0e5278c-c662-4d87-8460-9bb857ba5137	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	PT-2222-011	A-027	PL1/2x12	A36	19.000	661.00	1	not_started	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
3a6d37b6-f098-48f9-85ae-3dfd02ed2f02	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	PT-2222-012	A-034	W18x46	A992	20.000	672.00	1	not_started	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
b7e0492f-dba5-471f-9ce4-d2d676d46d46	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222204	PT-2222-001	A-007	C12x20.7	A36	19.000	551.00	1	complete	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
94dad6d1-86fd-4020-934a-94ebb538342a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222204	PT-2222-002	A-014	PL1/2x12	A36	20.000	562.00	1	complete	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
2b044ba9-264a-4cdc-b4ec-8fdb547ee346	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222204	PT-2222-003	A-021	W18x46	A992	21.000	573.00	1	complete	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
c4392223-a1f3-4580-aa56-66d2a8bf0085	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222204	PT-2222-004	A-028	C12x20.7	A36	22.000	584.00	1	complete	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
a1988ec0-345f-444e-bdc5-c3fb2cc7c59e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222204	PT-2222-005	A-035	PL1/2x12	A36	18.000	595.00	1	in_progress	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
67f8ae8b-af1a-4a5f-957c-4effdc62bf7e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222204	PT-2222-007	A-049	C12x20.7	A36	20.000	617.00	1	in_progress	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
8dfe6ade-0dc8-44c9-bee2-6955860446a6	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222204	PT-2222-008	A-006	PL1/2x12	A36	21.000	628.00	1	in_progress	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
7406149f-555f-41fb-940f-551f5d82b140	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222204	PT-2222-009	A-013	W18x46	A992	22.000	639.00	1	in_progress	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
84319273-db78-4b14-bd12-f5926aed5ee2	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222204	PT-2222-010	A-020	C12x20.7	A36	18.000	650.00	1	not_started	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
8093a5a4-0927-408c-8c0f-6695a421d8a9	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222204	PT-2222-011	A-027	PL1/2x12	A36	19.000	661.00	1	not_started	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
e502bb60-e1fe-4249-8a34-7421b1a38684	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	6be7ba57-5d35-4217-9e36-1ba381d9e306	PT-2222-012	A-034	W18x46	A992	20.000	672.00	1	not_started	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:30:33.861049+00
7887ac5f-6025-4653-b2fa-6dfd9609154c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	6be7ba57-5d35-4217-9e36-1ba381d9e306	PT-2222-006	A-042	W18x46	A992	19.000	606.00	1	in_progress	P1	\N	\N	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:30:41.421825+00
6e7810a1-afac-404f-9700-b1c77ad5000d	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	6be7ba57-5d35-4217-9e36-1ba381d9e306	AUTO-0001-HSS6x6x1/2	B-108	HSS6x6x1/2	A500-C	14.000	892.00	1	complete	P1	HT-23846	33333333-3333-3333-3333-333333333302	\N	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:31:13.986436+00
\.


--
-- Data for Name: erection_sequence; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."erection_sequence" ("id", "company_id", "project_id", "sequence_number", "part_id", "description", "load_number", "priority", "phase", "status", "created_at", "updated_at") FROM stdin;
6e000000-0000-0000-0000-000000000001	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	1	\N	Column bases — all column lines, Level 1	L-0041	1	Phase 1	complete	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
6e000000-0000-0000-0000-000000000002	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	2	\N	Spandrel beams — Grid A, Levels 1-2	L-0041	2	Phase 1	complete	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
6e000000-0000-0000-0000-000000000003	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	3	\N	Interior framing — Bays 1-4, Level 2	L-0040	3	Phase 1	in_progress	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
6e000000-0000-0000-0000-000000000004	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	4	\N	HSS diagonal bracing — All bays, Level 2-3	\N	4	Phase 1	not_started	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
6e000000-0000-0000-0000-000000000005	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	5	\N	Column continuation — Level 6-12	\N	5	Phase 2	in_progress	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
6e000000-0000-0000-0000-000000000006	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	6	\N	Floor beams — Level 6-12 all bays	\N	6	Phase 2	not_started	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
6e000000-0000-0000-0000-000000000007	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	7	\N	Stair stringers and landing framing	\N	7	Phase 2	in_progress	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
6e000000-0000-0000-0000-000000000008	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	8	\N	Penthouse framing and mechanical screen	\N	8	Phase 2	not_started	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
\.


--
-- Data for Name: estimates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."estimates" ("id", "company_id", "estimate_number", "project_name", "gc_name", "status", "total_amount", "bid_per_lb", "bid_per_ton", "structural_tons", "misc_metal_lbs", "margin_pct", "bid_due_date", "scenarios", "notes", "submitted_at", "won_at", "converted_project_id", "created_by", "created_at", "updated_at") FROM stdin;
99999999-aaaa-aaaa-aaaa-000000000001	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	EST-2026-041	Dallas Office Bldg	Turner Const.	submitted	612000.00	\N	\N	142.00	18400.00	22.40	2026-04-15	[]	\N	2026-04-24 12:11:42.190314+00	\N	\N	11111111-1111-1111-1111-111111111103	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
99999999-aaaa-aaaa-aaaa-000000000003	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	EST-2026-039	Austin Parking Garage	CBRE	draft	824000.00	\N	\N	201.00	4100.00	21.00	2026-04-20	[]	\N	\N	\N	\N	11111111-1111-1111-1111-111111111103	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
99999999-aaaa-aaaa-aaaa-000000000002	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	EST-2026-040	Houston Warehouse	Procon LLC	won	378000.00	\N	\N	88.00	9200.00	19.80	2026-03-30	[]	\N	2026-04-04 12:11:42.190314+00	2026-05-24 12:32:48.09+00	b0e92580-f157-47fb-8fc5-e3799b632c81	11111111-1111-1111-1111-111111111103	2026-05-24 12:11:42.190314+00	2026-05-24 12:32:48.090854+00
\.


--
-- Data for Name: estimate_line_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."estimate_line_items" ("id", "company_id", "estimate_id", "category", "description", "quantity", "unit_cost", "labor_hours", "sort_order", "created_at") FROM stdin;
\.


--
-- Data for Name: file_attachments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."file_attachments" ("id", "company_id", "entity_type", "entity_id", "storage_bucket", "storage_path", "mime_type", "size_bytes", "uploaded_by", "created_at") FROM stdin;
\.


--
-- Data for Name: gc_contacts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."gc_contacts" ("id", "company_id", "project_id", "gc_company", "contact_name", "role", "email", "phone", "notes", "last_contact", "created_at", "updated_at") FROM stdin;
aaaaaaaa-aaaa-aaaa-aaaa-00000000aa01	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	Turner Construction	Mark Johnson	Project Manager	m.johnson@turner.com	(214) 555-0182	\N	2026-05-22	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
aaaaaaaa-aaaa-aaaa-aaaa-00000000aa02	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	Turner Construction	Sarah Kim	Field Superintendent	s.kim@turner.com	(214) 555-0199	\N	2026-05-21	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
aaaaaaaa-aaaa-aaaa-aaaa-00000000aa03	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	Bechtel Corp	Steve Chen	Project Engineer	s.chen@bechtel.com	(713) 555-0241	\N	2026-05-19	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
aaaaaaaa-aaaa-aaaa-aaaa-00000000aa04	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	Apple Inc	David Park	Owner's Rep	d.park@apple.com	(512) 555-0341	\N	2026-05-17	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
aaaaaaaa-aaaa-aaaa-aaaa-00000000aa05	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222204	PCL Construction	James Wright	Project Manager	j.wright@pcl.com	(210) 555-0441	\N	2026-05-10	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
\.


--
-- Data for Name: heat_numbers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."heat_numbers" ("id", "company_id", "heat_number", "material_grade", "mill_name", "supplier", "mtr_status", "mtr_file_url", "receipt_number", "parts_count", "created_at", "updated_at") FROM stdin;
399355e2-a34b-4a6a-b054-9d9e4d523c2c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	HT-23900	A36	Gerdau	Reliance Steel	pending	\N	\N	16	2026-05-24 09:00:30.514794+00	2026-05-24 12:11:42.190314+00
d209054d-5eba-402f-9030-6d933a48df34	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	HT-23800	A992	Nucor Steel	Reliance Steel	verified	\N	\N	16	2026-05-24 09:00:30.514794+00	2026-05-24 12:11:42.190314+00
e1c7ee4b-07b7-4c4d-a8f0-84aac31b5552	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	HT-23845	A992	Nucor Steel	Triple S Steel	verified	\N	\N	17	2026-05-24 09:00:30.514794+00	2026-05-24 12:11:42.190314+00
988e778b-5ff3-4d3d-81a7-fef865b687c0	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	HN-8821A	A992	Nucor Steel TX	Nucor Steel TX	verified	\N	REC-0041	12	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
650a6136-a95a-451a-b07a-5c58a28ba8fb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	HN-7734B	A500-C	Steel Dynamics	Atlas Tube	pending	\N	REC-0040	6	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
bea4a643-b88e-4c06-87c7-e46faa754d3d	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	HN-6621A	A36	Gerdau	Service Ctr SW	verified	\N	REC-0039	8	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
3fece62b-de3b-47e3-92d7-d09291bdb3c2	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	HN-5541B	A36	Gerdau	Metals USA	verified	\N	REC-0037	5	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
d99a76d7-5a39-4b20-98a9-d4bb061e9074	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	HN-9012C	A992	Nucor Steel TX	Nucor Steel TX	verified	\N	REC-0038	4	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
e06133a8-2927-42d2-81de-4b35c0f1030e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	HT-23846	A500-C	Steel Dynamics	Triple S Steel	received	\N	\N	16	2026-05-24 09:00:30.514794+00	2026-05-24 12:31:13.986436+00
\.


--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."inventory" ("id", "company_id", "profile", "grade", "length", "quantity", "location", "reorder_point", "max_stock", "unit_cost", "created_at", "updated_at") FROM stdin;
6bccf3f2-add2-4b85-bd01-dc537656c63f	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	W14x82	A992	\N	24.00	Bay 1	10.00	50.00	1240.00	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
94ffa0d7-13c9-4db8-bf54-833df33abd97	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	W12x65	A992	\N	8.00	Bay 1	10.00	40.00	980.00	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
d95464ab-f8b4-4f85-944c-f21c0cfa5c64	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	HSS6x6x3/8	A500-C	\N	0.00	Bay 2	8.00	30.00	415.00	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
db36fbb4-07b7-45a5-9976-9fe29a4eb25c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	L4x4x1/2	A36	\N	42.00	Bay 3	15.00	80.00	165.00	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
b03d23d5-88f4-4838-8048-2543eae76721	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	C10x15.3	A36	\N	18.00	Bay 3	10.00	60.00	287.00	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
f350c997-be06-4cdc-abec-2b8a10ecf0c5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	HSS4x4x1/4	A500-C	\N	0.00	Bay 2	10.00	40.00	320.00	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
0e7fa674-6648-42d4-a9b9-04a30f46e46e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	W6x15	A992	\N	35.00	Bay 1	10.00	40.00	320.00	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
dc89790d-e0be-4f91-a8a7-9365b103c6db	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	W18x46	A992	\N	22.00	Bay 1	12.00	60.00	1100.00	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
cc1e8370-3236-4dd9-bb08-fbbdb91248a5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	W24x68	A992	\N	6.00	Bay 1	10.00	40.00	1730.00	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
2aa4755d-3261-4104-9793-b82b99f97a78	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	PL1/2x12	A36	\N	0.00	Bay 4	10.00	50.00	88.00	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
c512c688-b843-4b22-91af-e3da8908ef58	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	W8x31	A992	\N	28.00	Bay 1	12.00	50.00	410.00	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
\.


--
-- Data for Name: inventory_adjustments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."inventory_adjustments" ("id", "company_id", "inventory_id", "adjustment_type", "quantity_change", "reason", "reference_id", "reference_type", "adjusted_by", "created_at") FROM stdin;
\.


--
-- Data for Name: job_costs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."job_costs" ("id", "company_id", "project_id", "cost_code", "description", "budget_amount", "actual_amount", "committed", "created_at", "updated_at") FROM stdin;
cccccccc-cccc-cccc-cccc-000000000001	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	01-MAT-STR	Structural Steel Material	196000.00	182400.00	196000.00	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
cccccccc-cccc-cccc-cccc-000000000002	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	02-MAT-MM	Misc Metal Material	28000.00	24100.00	28000.00	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
cccccccc-cccc-cccc-cccc-000000000003	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	10-LAB-SHOP	Shop Labor	168000.00	121200.00	168000.00	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
cccccccc-cccc-cccc-cccc-000000000004	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	20-COAT	Paint / Coating	42000.00	38200.00	42000.00	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
cccccccc-cccc-cccc-cccc-000000000005	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	30-FRT	Freight / Shipping	24000.00	19840.00	24000.00	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
cccccccc-cccc-cccc-cccc-000000000006	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	40-OH	Overhead & Burden	64000.00	16100.00	64000.00	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
\.


--
-- Data for Name: ncr_reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."ncr_reports" ("id", "company_id", "project_id", "part_id", "ncr_number", "source_inspection_id", "source_inspection_type", "description", "root_cause", "corrective_action", "status", "blocks_shipping", "assigned_to", "closed_at", "closed_by", "created_by", "created_at", "updated_at") FROM stdin;
20f958f7-2cfe-4b06-aac6-b47a16098a73	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	38d794bb-c537-4e0a-a149-dffa51682223	NCR-0001	318247d6-5836-42c1-925c-9edc6f03798c	paint	Auto-generated from failed paint inspection PI-0001	\N	\N	open	t	11111111-1111-1111-1111-111111111105	\N	\N	11111111-1111-1111-1111-111111111105	2026-05-24 09:00:44.887844+00	2026-05-24 09:00:44.887844+00
f508ab27-2434-4575-81c2-5e9792ed6769	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	34e14b3f-27ac-4c8a-9bec-000589e8a230	ed47697e-e648-499a-955c-5bb1f9f0d51f	NCR-0002	67da7414-61a0-4468-b877-76c32ff2f06c	paint	Auto-generated from failed paint inspection PI-0002	\N	\N	open	t	11111111-1111-1111-1111-111111111105	\N	\N	11111111-1111-1111-1111-111111111105	2026-05-24 11:32:24.485833+00	2026-05-24 11:32:24.485833+00
900662a3-9e11-4b36-b3dc-6b58ff0a9323	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	0cb4b1c7-b130-4790-ba3c-a57b073b191c	NCR-0003	eeeeeeee-eeee-eeee-eeee-000000000438	weld	Auto-generated from failed weld inspection WLD-0438	\N	\N	open	t	11111111-1111-1111-1111-111111111105	\N	\N	11111111-1111-1111-1111-111111111105	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
8d538808-ffb1-44f9-b870-d5af4b94281e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	6e7810a1-afac-404f-9700-b1c77ad5000d	NCR-0004	dddddddd-dddd-dddd-dddd-000000000441	paint	Auto-generated from failed paint inspection PI-0441	\N	\N	open	t	11111111-1111-1111-1111-111111111105	\N	\N	11111111-1111-1111-1111-111111111105	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
c8bafaa0-59fa-4fcf-80d2-1cf730cb5bcb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	0cb4b1c7-b130-4790-ba3c-a57b073b191c	NCR-0005	dddddddd-dddd-dddd-dddd-000000000440	paint	Auto-generated from failed paint inspection PI-0440	\N	\N	open	t	11111111-1111-1111-1111-111111111105	\N	\N	11111111-1111-1111-1111-111111111105	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
cb3fc659-8d66-44a3-bc6a-7ef8dfa85fd2	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	52bc823d-5ac0-4427-8104-2e655a64154a	NCR-0006	dddddddd-dddd-dddd-dddd-000000000439	paint	Auto-generated from failed paint inspection PI-0439	\N	\N	open	t	11111111-1111-1111-1111-111111111105	\N	\N	11111111-1111-1111-1111-111111111105	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
ffffffff-ffff-ffff-ffff-000000000001	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	0cb4b1c7-b130-4790-ba3c-a57b073b191c	NCR-0001	\N	\N	Paint DFT below required minimum (5.1 vs 5.5 mil)	Insufficient topcoat passes	\N	open	t	\N	\N	\N	11111111-1111-1111-1111-111111111105	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
ffffffff-ffff-ffff-ffff-000000000002	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	\N	NCR-0002	\N	\N	Weld undercut exceeds AWS D1.1 §5.22 tolerance	Inadequate amperage settings on SMAW	\N	in_progress	t	\N	\N	\N	11111111-1111-1111-1111-111111111105	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."notifications" ("id", "company_id", "user_id", "type", "title", "message", "entity_type", "entity_id", "entity_link", "is_read", "read_at", "created_at") FROM stdin;
29897533-0252-4f13-be0d-10a99954ff00	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	cert_expiry	CWI cert expiring in 18 days	Linda Chen — renew AWS-CWI-23145	certifications	\N	/dashboard/certifications	f	\N	2026-05-24 09:00:30.514794+00
8598561d-69b1-4d33-b556-b2a1f531431f	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111104	inventory_low	HSS6x6x3/8 out of stock	Reorder before tomorrow shift	inventory	\N	/dashboard/inventory	f	\N	2026-05-24 09:00:30.514794+00
caf9ecdd-3476-448f-8faa-077355f9de4d	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	co_approved	CO-042 approved by Sarah	Contract value updated to $624,400	change_orders	\N	/dashboard/change-orders	f	\N	2026-05-24 09:00:30.514794+00
c4007204-8551-481e-b34e-cb40ff78028b	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	qc_failure	Inspection failed: PI-0002	Auto-NCR will be opened	paint_inspections	67da7414-61a0-4468-b877-76c32ff2f06c	/dashboard/paint-inspections	f	\N	2026-05-24 11:32:24.485833+00
0a566389-570e-4e5c-8636-fcde83c90f28	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	qc_failure	Inspection failed: PI-0002	Auto-NCR will be opened	paint_inspections	67da7414-61a0-4468-b877-76c32ff2f06c	/dashboard/paint-inspections	f	\N	2026-05-24 11:32:24.485833+00
407ab169-e3a7-4f4e-84c2-782b7b72c009	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	ncr_created	New NCR: NCR-0002	Auto-generated from failed paint inspection PI-0002	ncr_reports	f508ab27-2434-4575-81c2-5e9792ed6769	/dashboard/paint-inspection	f	\N	2026-05-24 11:32:24.485833+00
81642b96-46b0-4f2a-ad3c-794756aa93c7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	ncr_created	New NCR: NCR-0002	Auto-generated from failed paint inspection PI-0002	ncr_reports	f508ab27-2434-4575-81c2-5e9792ed6769	/dashboard/paint-inspection	f	\N	2026-05-24 11:32:24.485833+00
0fc636ef-f986-4ba0-a09e-03649a8e307e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	ncr_created	New NCR: NCR-0002	Auto-generated from failed paint inspection PI-0002	ncr_reports	f508ab27-2434-4575-81c2-5e9792ed6769	/dashboard/paint-inspection	f	\N	2026-05-24 11:32:24.485833+00
a2c042a0-751f-4a35-95fc-7a2567c063d9	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	co_approved	CO approved: CO-040	Amount $8400.00	change_orders	77777777-7777-7777-7777-000000000040	/dashboard/change-orders	f	\N	2026-05-24 12:11:42.190314+00
30d001fe-aebe-40ee-ad76-db752e376ba3	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	co_approved	CO approved: CO-040	Amount $8400.00	change_orders	77777777-7777-7777-7777-000000000040	/dashboard/change-orders	f	\N	2026-05-24 12:11:42.190314+00
9358c380-bfcd-49be-bd8f-f8792736b63a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111103	co_approved	CO approved: CO-040	Amount $8400.00	change_orders	77777777-7777-7777-7777-000000000040	/dashboard/change-orders	f	\N	2026-05-24 12:11:42.190314+00
90221ff2-ad97-4bf2-901b-f7dbe64e6dbf	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111106	co_approved	CO approved: CO-040	Amount $8400.00	change_orders	77777777-7777-7777-7777-000000000040	/dashboard/change-orders	f	\N	2026-05-24 12:11:42.190314+00
861bf22a-3025-4bf0-9b71-44a4621773c7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	co_approved	CO approved: CO-039	Amount $3200.00	change_orders	77777777-7777-7777-7777-000000000039	/dashboard/change-orders	f	\N	2026-05-24 12:11:42.190314+00
176682ce-24bf-44e7-adf3-f0dfabf8aca8	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	co_approved	CO approved: CO-039	Amount $3200.00	change_orders	77777777-7777-7777-7777-000000000039	/dashboard/change-orders	f	\N	2026-05-24 12:11:42.190314+00
75079df3-a9db-4187-a883-4015136dc76a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111103	co_approved	CO approved: CO-039	Amount $3200.00	change_orders	77777777-7777-7777-7777-000000000039	/dashboard/change-orders	f	\N	2026-05-24 12:11:42.190314+00
464c8ff5-1f6d-4380-894a-bc0a170c253c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111106	co_approved	CO approved: CO-039	Amount $3200.00	change_orders	77777777-7777-7777-7777-000000000039	/dashboard/change-orders	f	\N	2026-05-24 12:11:42.190314+00
ac3964db-ec5b-4de3-8a80-cc92d8608c96	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	info	New RFI: RFI-0081	Confirm W14×82 base plate hole pattern — conflicts with DS-104 Rev D and structural calc	rfis	88888888-8888-8888-8888-000000000081	/dashboard/rfis	f	\N	2026-05-24 12:11:42.190314+00
bb0a2669-1a0a-4ab6-b26a-47fed9777874	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	info	New RFI: RFI-0081	Confirm W14×82 base plate hole pattern — conflicts with DS-104 Rev D and structural calc	rfis	88888888-8888-8888-8888-000000000081	/dashboard/rfis	f	\N	2026-05-24 12:11:42.190314+00
c6d51907-6ade-423b-9692-d35575439a46	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111103	info	New RFI: RFI-0081	Confirm W14×82 base plate hole pattern — conflicts with DS-104 Rev D and structural calc	rfis	88888888-8888-8888-8888-000000000081	/dashboard/rfis	f	\N	2026-05-24 12:11:42.190314+00
5ac5b037-4a0e-4b26-9334-324ed35f701c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	info	New RFI: RFI-0080	ASTM A36 vs A572 Gr.50 for gusset plates — spec sheet ambiguous	rfis	88888888-8888-8888-8888-000000000080	/dashboard/rfis	f	\N	2026-05-24 12:11:42.190314+00
87809223-9b40-4528-916c-a7530c39483c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	info	New RFI: RFI-0080	ASTM A36 vs A572 Gr.50 for gusset plates — spec sheet ambiguous	rfis	88888888-8888-8888-8888-000000000080	/dashboard/rfis	f	\N	2026-05-24 12:11:42.190314+00
781a8aae-ebac-4e0b-bb5b-3c83a67bca1f	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111103	info	New RFI: RFI-0080	ASTM A36 vs A572 Gr.50 for gusset plates — spec sheet ambiguous	rfis	88888888-8888-8888-8888-000000000080	/dashboard/rfis	f	\N	2026-05-24 12:11:42.190314+00
ecbe0dc0-5ae6-4d8e-b571-31f4dff32bfc	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	info	New RFI: RFI-0079	Galvanizing spec for exterior HSS — ASTM A123 or A153?	rfis	88888888-8888-8888-8888-000000000079	/dashboard/rfis	f	\N	2026-05-24 12:11:42.190314+00
45cee10c-1644-4a76-9ee0-9bcf193c1bcc	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	info	New RFI: RFI-0079	Galvanizing spec for exterior HSS — ASTM A123 or A153?	rfis	88888888-8888-8888-8888-000000000079	/dashboard/rfis	f	\N	2026-05-24 12:11:42.190314+00
42f8a137-728f-4e2d-9116-f2a3730a590e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111103	info	New RFI: RFI-0079	Galvanizing spec for exterior HSS — ASTM A123 or A153?	rfis	88888888-8888-8888-8888-000000000079	/dashboard/rfis	f	\N	2026-05-24 12:11:42.190314+00
7c8b059f-84f8-4bb0-9abc-29c65512d788	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	qc_failure	Inspection failed: WLD-0438	Auto-NCR will be opened	weld_inspections	eeeeeeee-eeee-eeee-eeee-000000000438	/dashboard/weld-inspections	f	\N	2026-05-24 12:11:42.190314+00
9560d6a2-059b-44a7-84a8-12aa0e76ba91	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	qc_failure	Inspection failed: WLD-0438	Auto-NCR will be opened	weld_inspections	eeeeeeee-eeee-eeee-eeee-000000000438	/dashboard/weld-inspections	f	\N	2026-05-24 12:11:42.190314+00
693992cf-da40-47b8-a92e-068383d579cd	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	ncr_created	New NCR: NCR-0003	Auto-generated from failed weld inspection WLD-0438	ncr_reports	900662a3-9e11-4b36-b3dc-6b58ff0a9323	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
8e37f9d1-e507-417e-ab96-354683e9869c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	ncr_created	New NCR: NCR-0003	Auto-generated from failed weld inspection WLD-0438	ncr_reports	900662a3-9e11-4b36-b3dc-6b58ff0a9323	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
af93981c-545f-42c1-a4e0-f7e246fff994	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	ncr_created	New NCR: NCR-0003	Auto-generated from failed weld inspection WLD-0438	ncr_reports	900662a3-9e11-4b36-b3dc-6b58ff0a9323	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
528c123b-ed9b-4ea1-9e5e-e7f292ba7aeb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	qc_failure	Inspection failed: PI-0441	Auto-NCR will be opened	paint_inspections	dddddddd-dddd-dddd-dddd-000000000441	/dashboard/paint-inspections	f	\N	2026-05-24 12:11:42.190314+00
d4786e99-084b-40db-b097-71006cf05ee3	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	qc_failure	Inspection failed: PI-0441	Auto-NCR will be opened	paint_inspections	dddddddd-dddd-dddd-dddd-000000000441	/dashboard/paint-inspections	f	\N	2026-05-24 12:11:42.190314+00
c4620c01-8189-4e40-ae2e-4d97eeb826e7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	ncr_created	New NCR: NCR-0004	Auto-generated from failed paint inspection PI-0441	ncr_reports	8d538808-ffb1-44f9-b870-d5af4b94281e	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
e4d8356d-9dac-4fc9-8eb2-d22befa6fb5e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	ncr_created	New NCR: NCR-0004	Auto-generated from failed paint inspection PI-0441	ncr_reports	8d538808-ffb1-44f9-b870-d5af4b94281e	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
a4c7564d-49d4-4564-abd0-40b3e24d1630	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	ncr_created	New NCR: NCR-0004	Auto-generated from failed paint inspection PI-0441	ncr_reports	8d538808-ffb1-44f9-b870-d5af4b94281e	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
74fe3938-c79e-4240-a752-ea2683125089	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	qc_failure	Inspection failed: PI-0440	Auto-NCR will be opened	paint_inspections	dddddddd-dddd-dddd-dddd-000000000440	/dashboard/paint-inspections	f	\N	2026-05-24 12:11:42.190314+00
62eaf530-67a8-4033-b03b-d8f925d2e5cf	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	qc_failure	Inspection failed: PI-0440	Auto-NCR will be opened	paint_inspections	dddddddd-dddd-dddd-dddd-000000000440	/dashboard/paint-inspections	f	\N	2026-05-24 12:11:42.190314+00
09e505ac-3746-4d14-a529-bb17f0f13e0e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	ncr_created	New NCR: NCR-0005	Auto-generated from failed paint inspection PI-0440	ncr_reports	c8bafaa0-59fa-4fcf-80d2-1cf730cb5bcb	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
f920c160-d741-4d6d-83b2-698197c73549	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	ncr_created	New NCR: NCR-0005	Auto-generated from failed paint inspection PI-0440	ncr_reports	c8bafaa0-59fa-4fcf-80d2-1cf730cb5bcb	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
eb4fdd0b-457a-434e-8fd5-75f008e5be4a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	ncr_created	New NCR: NCR-0005	Auto-generated from failed paint inspection PI-0440	ncr_reports	c8bafaa0-59fa-4fcf-80d2-1cf730cb5bcb	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
97303578-879c-499c-9d15-f40409d10db6	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	qc_failure	Inspection failed: PI-0439	Auto-NCR will be opened	paint_inspections	dddddddd-dddd-dddd-dddd-000000000439	/dashboard/paint-inspections	f	\N	2026-05-24 12:11:42.190314+00
7ea4b9c7-263d-499c-a4bd-8de6dca87ac9	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	qc_failure	Inspection failed: PI-0439	Auto-NCR will be opened	paint_inspections	dddddddd-dddd-dddd-dddd-000000000439	/dashboard/paint-inspections	f	\N	2026-05-24 12:11:42.190314+00
c49ec8df-985a-409c-a8f4-93e58e4cbe96	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	ncr_created	New NCR: NCR-0006	Auto-generated from failed paint inspection PI-0439	ncr_reports	cb3fc659-8d66-44a3-bc6a-7ef8dfa85fd2	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
27ba7744-7eed-463e-ac7d-c86c1940cc47	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	ncr_created	New NCR: NCR-0006	Auto-generated from failed paint inspection PI-0439	ncr_reports	cb3fc659-8d66-44a3-bc6a-7ef8dfa85fd2	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
e37f6961-a16c-46e8-9fbb-293bcac57276	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	ncr_created	New NCR: NCR-0006	Auto-generated from failed paint inspection PI-0439	ncr_reports	cb3fc659-8d66-44a3-bc6a-7ef8dfa85fd2	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
c0d7da9d-dba1-4c72-86a1-2364c183fa48	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	ncr_created	New NCR: NCR-0001	Paint DFT below required minimum (5.1 vs 5.5 mil)	ncr_reports	ffffffff-ffff-ffff-ffff-000000000001	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
bc5a4612-8f9e-4047-b980-ccb5708553ff	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	ncr_created	New NCR: NCR-0001	Paint DFT below required minimum (5.1 vs 5.5 mil)	ncr_reports	ffffffff-ffff-ffff-ffff-000000000001	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
e334f903-bae8-4469-bf4f-94c02c29435e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	ncr_created	New NCR: NCR-0001	Paint DFT below required minimum (5.1 vs 5.5 mil)	ncr_reports	ffffffff-ffff-ffff-ffff-000000000001	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
8387a0d8-762d-47e6-8561-9d6c96b4a139	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	ncr_created	New NCR: NCR-0002	Weld undercut exceeds AWS D1.1 §5.22 tolerance	ncr_reports	ffffffff-ffff-ffff-ffff-000000000002	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
3e566bfa-18a3-4afd-bc7b-62f9f784d247	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	ncr_created	New NCR: NCR-0002	Weld undercut exceeds AWS D1.1 §5.22 tolerance	ncr_reports	ffffffff-ffff-ffff-ffff-000000000002	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
3469693a-ff92-4733-8043-dae355d2b962	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	ncr_created	New NCR: NCR-0002	Weld undercut exceeds AWS D1.1 §5.22 tolerance	ncr_reports	ffffffff-ffff-ffff-ffff-000000000002	/dashboard/paint-inspection	f	\N	2026-05-24 12:11:42.190314+00
c0c4a410-8e29-45e8-8e1c-34aa729b351a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	inventory_low	Low stock: HSS4x4x1/4	Quantity 0.00 (reorder at 10.00)	inventory	f350c997-be06-4cdc-abec-2b8a10ecf0c5	/dashboard/inventory	f	\N	2026-05-24 12:11:42.190314+00
b09b8fc4-f15c-4245-83d9-9bcc192df2bd	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	inventory_low	Low stock: HSS4x4x1/4	Quantity 0.00 (reorder at 10.00)	inventory	f350c997-be06-4cdc-abec-2b8a10ecf0c5	/dashboard/inventory	f	\N	2026-05-24 12:11:42.190314+00
1d964fb5-7943-46b3-8dec-69311930da37	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111104	inventory_low	Low stock: HSS4x4x1/4	Quantity 0.00 (reorder at 10.00)	inventory	f350c997-be06-4cdc-abec-2b8a10ecf0c5	/dashboard/inventory	f	\N	2026-05-24 12:11:42.190314+00
f07da0df-c7a1-4f7b-af78-41e7a5add3c3	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	inventory_low	Low stock: W24x68	Quantity 6.00 (reorder at 10.00)	inventory	cc1e8370-3236-4dd9-bb08-fbbdb91248a5	/dashboard/inventory	f	\N	2026-05-24 12:11:42.190314+00
777978c2-d519-43f4-a9b2-a3c059e1f557	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	inventory_low	Low stock: W24x68	Quantity 6.00 (reorder at 10.00)	inventory	cc1e8370-3236-4dd9-bb08-fbbdb91248a5	/dashboard/inventory	f	\N	2026-05-24 12:11:42.190314+00
2296ba03-420f-441d-bcb6-004a13666889	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111104	inventory_low	Low stock: W24x68	Quantity 6.00 (reorder at 10.00)	inventory	cc1e8370-3236-4dd9-bb08-fbbdb91248a5	/dashboard/inventory	f	\N	2026-05-24 12:11:42.190314+00
8072c7c4-aac7-4997-b519-9f717bcd7997	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	inventory_low	Low stock: PL1/2x12	Quantity 0.00 (reorder at 10.00)	inventory	2aa4755d-3261-4104-9793-b82b99f97a78	/dashboard/inventory	f	\N	2026-05-24 12:11:42.190314+00
1f0555e1-0d39-4333-a4fd-060f8390608d	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	inventory_low	Low stock: PL1/2x12	Quantity 0.00 (reorder at 10.00)	inventory	2aa4755d-3261-4104-9793-b82b99f97a78	/dashboard/inventory	f	\N	2026-05-24 12:11:42.190314+00
f3a17833-d59e-4e79-9ae2-3649ca9cbbfd	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111104	inventory_low	Low stock: PL1/2x12	Quantity 0.00 (reorder at 10.00)	inventory	2aa4755d-3261-4104-9793-b82b99f97a78	/dashboard/inventory	f	\N	2026-05-24 12:11:42.190314+00
4961d8de-96e4-45d5-8091-2e8d2389632a	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	co_approved	CO-040 approved	Base plate gusset addition approved	change_orders	\N	/dashboard/change-orders	f	\N	2026-05-24 12:11:42.190314+00
90bdfbf5-5f5a-47db-9f06-b5f0f8dcdd84	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	ncr_created	NCR-0001 opened	Paint DFT below required min on AUTO-0002	ncr_reports	\N	/dashboard/ncr	f	\N	2026-05-24 12:11:42.190314+00
e9e291f8-b947-4d40-b51d-4562f1dd3404	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111102	info	RFI-0081 awaiting EOR	Confirm W14×82 base plate hole pattern	rfis	\N	/dashboard/rfis	f	\N	2026-05-24 12:11:42.190314+00
a341087b-6b55-4dcb-994a-f6829695b371	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111105	qc_failure	Weld inspection failed	WLD-0438 — repair per AWS D1.1 §5.22	weld_inspections	\N	/dashboard/weld-log	f	\N	2026-05-24 12:11:42.190314+00
8e842761-57af-42dd-89a4-378ff1e9a2b7	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111104	inventory_low	HSS4×4×¼ out of stock	Reorder before next shift	inventory	\N	/dashboard/inventory	f	\N	2026-05-24 12:11:42.190314+00
0a1b014b-70fd-478e-bdb3-b1e33f9c0d3e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	11111111-1111-1111-1111-111111111101	info	PO-2026-0184 fully received	Nucor Steel TX — 48 pieces W14×82	purchase_orders	\N	/dashboard/receiving	f	\N	2026-05-24 12:11:42.190314+00
\.


--
-- Data for Name: osha_checklists; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."osha_checklists" ("id", "company_id", "section_ref", "item_text", "category", "status", "assigned_to", "notes", "cleared_at", "sort_order", "created_at", "updated_at") FROM stdin;
355c93c2-7560-4ecf-ac30-8a9fc7493a73	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	29 CFR 1910.132	Hard hats issued and inspected	PPE	open	\N	\N	\N	1	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
62ecd7ae-7d31-4b5d-8038-5c5f7302292f	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	29 CFR 1910.133	Safety glasses required in shop	PPE	open	\N	\N	\N	2	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
a0f06c4a-9aff-471e-b9ca-5f4de0bea740	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	29 CFR 1910.252	Hot work permit posted	Welding Safety	open	\N	\N	\N	3	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
128fdb9b-e9c3-4ae1-a5cf-c7cf630e3a21	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	29 CFR 1910.252	Welding screens and ventilation in place	Welding Safety	open	\N	\N	\N	4	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
74feb824-0531-4803-a21e-ed5ce539871e	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	29 CFR 1926.501	Fall arrest > 6ft documented	Fall Protection	open	\N	\N	\N	5	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
6ba39882-c6f5-4374-b17c-0fb5cf9f2d32	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	29 CFR 1926.1400	Crane operator certification current	Cranes	open	\N	\N	\N	6	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
7093322b-2155-4527-9eba-b66a9d4a8374	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	29 CFR 1926.1412	Annual crane inspection on file	Cranes	open	\N	\N	\N	7	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
8b61b80f-413c-492b-bc95-234ead361f5d	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	29 CFR 1910.157	Extinguishers inspected monthly	Fire Safety	open	\N	\N	\N	8	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
1f0780f9-4373-4c93-b4fa-de773adf18f8	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	29 CFR 1910.176	Rigging gear inspected pre-shift	Material Handling	open	\N	\N	\N	9	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
f6e8d8ac-9c76-4238-98bf-85da9e76d4c0	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	29 CFR 1910.151	First aid kits stocked and accessible	First Aid	open	\N	\N	\N	10	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
\.


--
-- Data for Name: paint_inspections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."paint_inspections" ("id", "company_id", "project_id", "part_id", "insp_number", "surface_prep", "primer_dft", "topcoat_dft", "required_min", "inspector_id", "inspector_name", "result", "ambient_temp", "humidity_pct", "notes", "inspection_date", "created_at", "updated_at") FROM stdin;
318247d6-5836-42c1-925c-9edc6f03798c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	38d794bb-c537-4e0a-a149-dffa51682223	PI-0001	SSPC-SP10	2.0	1.0	5.0	\N	Linda Chen	fail	\N	\N	\N	2026-05-24	2026-05-24 09:00:44.887844+00	2026-05-24 09:00:44.887844+00
67da7414-61a0-4468-b877-76c32ff2f06c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	34e14b3f-27ac-4c8a-9bec-000589e8a230	ed47697e-e648-499a-955c-5bb1f9f0d51f	PI-0002	SP6	1.2	1.8	4.0	\N	Linda Chen	fail	\N	\N	\N	2026-05-24	2026-05-24 11:32:24.485833+00	2026-05-24 11:32:24.485833+00
dddddddd-dddd-dddd-dddd-000000000441	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	6e7810a1-afac-404f-9700-b1c77ad5000d	PI-0441	SSPC-SP10	3.2	2.8	5.5	11111111-1111-1111-1111-111111111105	J. Reyes	fail	72.0	48.0	Within spec	2026-05-22	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
dddddddd-dddd-dddd-dddd-000000000440	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	0cb4b1c7-b130-4790-ba3c-a57b073b191c	PI-0440	SSPC-SP10	2.7	2.4	5.5	11111111-1111-1111-1111-111111111105	J. Reyes	fail	68.0	62.0	Total DFT below required min — rework	2026-05-22	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
dddddddd-dddd-dddd-dddd-000000000439	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	52bc823d-5ac0-4427-8104-2e655a64154a	PI-0439	SSPC-SP10	3.4	2.9	5.5	11111111-1111-1111-1111-111111111105	J. Reyes	fail	70.0	50.0	Within spec	2026-05-21	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."purchase_orders" ("id", "company_id", "project_id", "po_number", "vendor", "items", "total_amount", "qty_ordered", "qty_received", "receiving_status", "status", "issued_date", "expected_date", "received_date", "notes", "created_by", "created_at", "updated_at") FROM stdin;
66666666-6666-6666-6666-000000000184	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	PO-2026-0184	Nucor Steel TX	[]	38400.00	48.00	48.00	fully_received	received	2026-05-10	2026-05-17	2026-05-19	\N	11111111-1111-1111-1111-111111111102	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
66666666-6666-6666-6666-000000000183	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	PO-2026-0183	Atlas Tube	[]	52800.00	120.00	48.00	partial	partial	2026-05-05	2026-05-15	\N	\N	11111111-1111-1111-1111-111111111102	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
66666666-6666-6666-6666-000000000182	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	PO-2026-0182	Service Ctr SW	[]	8200.00	200.00	200.00	fully_received	received	2026-05-03	2026-05-14	2026-05-15	\N	11111111-1111-1111-1111-111111111102	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
66666666-6666-6666-6666-000000000181	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	PO-2026-0181	Metals USA	[]	3100.00	50.00	0.00	pending	issued	2026-04-30	2026-05-31	\N	\N	11111111-1111-1111-1111-111111111102	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
66666666-6666-6666-6666-000000000180	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	PO-2026-0180	Nucor Steel TX	[]	44100.00	30.00	24.00	partial	partial	2026-04-27	2026-05-10	\N	\N	11111111-1111-1111-1111-111111111102	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
\.


--
-- Data for Name: rate_limit_buckets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."rate_limit_buckets" ("id", "count", "window_start", "updated_at") FROM stdin;
162.247.243.32	7	2026-05-24 12:31:55.826775+00	2026-05-24 12:32:48.105019+00
\.


--
-- Data for Name: rfis; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."rfis" ("id", "company_id", "project_id", "rfi_number", "question", "answer", "status", "submitted_by", "submitted_to", "responded_by", "date_answered", "created_at", "updated_at") FROM stdin;
88888888-8888-8888-8888-000000000081	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	RFI-0081	Confirm W14×82 base plate hole pattern — conflicts with DS-104 Rev D and structural calc	\N	open	11111111-1111-1111-1111-111111111102	Smith Engineering (EOR)	\N	\N	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
88888888-8888-8888-8888-000000000080	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	RFI-0080	ASTM A36 vs A572 Gr.50 for gusset plates — spec sheet ambiguous	Use A572 Gr.50 for all gusset plates per structural notes §5.4	answered	11111111-1111-1111-1111-111111111102	Bechtel Design	\N	2026-05-17	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
88888888-8888-8888-8888-000000000079	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	RFI-0079	Galvanizing spec for exterior HSS — ASTM A123 or A153?	ASTM A123 for all members > 1/8". A153 for hardware only.	answered	11111111-1111-1111-1111-111111111102	Apple / CBRE	\N	2026-05-10	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
\.


--
-- Data for Name: security_audit_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."security_audit_log" ("id", "event_type", "user_id", "email", "ip_address", "user_agent", "metadata", "created_at") FROM stdin;
\.


--
-- Data for Name: sequence_counters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."sequence_counters" ("id", "company_id", "table_name", "prefix", "current_value", "width", "updated_at") FROM stdin;
d134aae5-37c3-46ca-930e-d7d8a3483260	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	paint_inspections	PI	2	4	2026-05-24 11:32:24.480265+00
f5bf7c03-475f-4294-a838-de946a64c677	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	rfis	RFI	81	4	2026-05-24 12:11:42.190314+00
0f9b6a9e-10a0-4b9f-888b-1cff36a9f4fb	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	change_orders	CO	41	3	2026-05-24 12:11:42.190314+00
09e1ef7d-5e72-48d5-bebf-5c5281215f3c	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	ncr_reports	NCR	6	4	2026-05-24 12:11:42.190314+00
91f6d9d7-c177-46b2-92ce-f1a273982362	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	estimates	EST-2026	41	3	2026-05-24 12:11:42.190314+00
9774ff73-5b0b-4f4b-9f44-4b38e8465487	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	purchase_orders	PO-2026	184	4	2026-05-24 12:11:42.190314+00
695c0426-41fb-4c06-8910-af2e8f6444a0	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	shipping_tickets	TKT	41	4	2026-05-24 12:11:42.190314+00
7ee6530b-7f68-439b-a410-684613459ccf	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	billing_applications	BILL	3	3	2026-05-24 12:11:42.190314+00
2f1901b4-1d62-473b-9361-9e0d2d228fe5	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	projects	PRJ-2026	5	4	2026-05-24 12:32:48.085256+00
\.


--
-- Data for Name: shipping_tickets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."shipping_tickets" ("id", "company_id", "project_id", "ticket_number", "load_number", "truck_number", "carrier", "driver_name", "ship_date", "destination", "parts", "total_pieces", "total_weight", "bol_url", "status", "created_by", "created_at", "updated_at") FROM stdin;
5b000000-0000-0000-0000-000000000041	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	TKT-0041	L-0041	JL-2841	J&L Trucking	Mike T.	2026-05-22	Dallas, TX	[]	14	18420.00	\N	delivered	11111111-1111-1111-1111-111111111104	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
5b000000-0000-0000-0000-000000000040	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	TKT-0040	L-0040	JL-2841	J&L Trucking	Mike T.	2026-05-24	Dallas, TX	[]	22	28640.00	\N	in_transit	11111111-1111-1111-1111-111111111104	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
5b000000-0000-0000-0000-000000000039	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222202	TKT-0039	L-0039	SW-441	Southwest Freight	Carlos R.	2026-05-25	Houston, TX	[]	18	12100.00	\N	pending	11111111-1111-1111-1111-111111111104	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
5b000000-0000-0000-0000-000000000038	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222203	TKT-0038	L-0038	\N	\N	\N	2026-05-28	Austin, TX	[]	10	6800.00	\N	pending	11111111-1111-1111-1111-111111111104	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."subscriptions" ("id", "company_id", "plan", "status", "current_period_start", "current_period_end", "max_users", "max_projects", "stripe_customer_id", "stripe_subscription_id", "created_at", "updated_at") FROM stdin;
91df0812-6d4d-4c65-9875-4a1d5ea87b74	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	professional	active	2026-05-24 09:00:30.514794+00	2026-06-23 09:00:30.514794+00	25	25	\N	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00
\.


--
-- Data for Name: user_invitations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."user_invitations" ("id", "company_id", "email", "role", "invited_by", "token", "expires_at", "accepted_at", "created_at") FROM stdin;
\.


--
-- Data for Name: weld_inspections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."weld_inspections" ("id", "company_id", "project_id", "part_id", "weld_number", "joint_type", "fillet_size", "weld_process", "filler_metal", "inspection_method", "cwi_reference", "inspector_id", "inspector_name", "result", "aws_d11_reference", "notes", "inspection_date", "created_at", "updated_at") FROM stdin;
eeeeeeee-eeee-eeee-eeee-000000000441	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	6e7810a1-afac-404f-9700-b1c77ad5000d	WLD-0441	CJP Groove	\N	FCAW	E71T-1	UT	CWI-2841	11111111-1111-1111-1111-111111111105	D. Nguyen	pending	AWS D1.1 §6.9	Weld complete — UT scheduled in 2 days	2026-05-22	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
eeeeeeee-eeee-eeee-eeee-000000000440	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	6e7810a1-afac-404f-9700-b1c77ad5000d	WLD-0440	Fillet 5/16"	\N	FCAW	E71T-1	VT	CWI-2841	11111111-1111-1111-1111-111111111105	D. Nguyen	pass	AWS D1.1 §6.9	Visual inspection — acceptable	2026-05-22	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
eeeeeeee-eeee-eeee-eeee-000000000439	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	0cb4b1c7-b130-4790-ba3c-a57b073b191c	WLD-0439	CJP Groove	\N	GMAW	ER70S-6	MT	CWI-2841	11111111-1111-1111-1111-111111111105	D. Nguyen	pass	AWS D1.1 §6.10	MT performed — no linear indications	2026-05-21	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
eeeeeeee-eeee-eeee-eeee-000000000438	aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa	22222222-2222-2222-2222-222222222201	0cb4b1c7-b130-4790-ba3c-a57b073b191c	WLD-0438	PJP Groove	\N	SMAW	E7018	VT	SCWI-4821	11111111-1111-1111-1111-111111111105	M. Kowalski	fail	AWS D1.1 §5.22	Undercut >1/32" — repair required	2026-05-20	2026-05-24 12:11:42.190314+00	2026-05-24 12:11:42.190314+00
\.


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") FROM stdin;
drawings	drawings	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	f	f	\N	\N	\N	STANDARD
mtrs	mtrs	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	f	f	\N	\N	\N	STANDARD
photos	photos	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	f	f	\N	\N	\N	STANDARD
billing	billing	\N	2026-05-24 09:00:30.514794+00	2026-05-24 09:00:30.514794+00	f	f	\N	\N	\N	STANDARD
\.


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets_analytics" ("name", "type", "format", "created_at", "updated_at", "id", "deleted_at") FROM stdin;
\.


--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."buckets_vectors" ("id", "type", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: iceberg_namespaces; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."iceberg_namespaces" ("id", "bucket_name", "name", "created_at", "updated_at", "metadata", "catalog_id") FROM stdin;
\.


--
-- Data for Name: iceberg_tables; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."iceberg_tables" ("id", "namespace_id", "bucket_name", "name", "location", "created_at", "updated_at", "remote_table_id", "shard_key", "shard_id", "catalog_id") FROM stdin;
\.


--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata") FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."s3_multipart_uploads" ("id", "in_progress_size", "upload_signature", "bucket_id", "key", "version", "owner_id", "created_at", "user_metadata", "metadata") FROM stdin;
\.


--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."s3_multipart_uploads_parts" ("id", "upload_id", "size", "part_number", "bucket_id", "key", "etag", "owner_id", "version", "created_at") FROM stdin;
\.


--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

COPY "storage"."vector_indexes" ("id", "name", "bucket_id", "data_type", "dimension", "distance_metric", "metadata_configuration", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: hooks; Type: TABLE DATA; Schema: supabase_functions; Owner: supabase_functions_admin
--

COPY "supabase_functions"."hooks" ("id", "hook_table_id", "hook_name", "created_at", "request_id") FROM stdin;
\.


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 47, true);


--
-- Name: hooks_id_seq; Type: SEQUENCE SET; Schema: supabase_functions; Owner: supabase_functions_admin
--

SELECT pg_catalog.setval('"supabase_functions"."hooks_id_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

-- \unrestrict IvjD3Taon3cC0uSmYduc2fNu5kalIFeib8FUc1g7icq7dnhPEAM7A8k3mN00zrQ

RESET ALL;
