# 日报 · 2026-06-18

- 生成时间：2026-06-18 22:43:39 UTC
- 当次推荐总数：17
- 精读区：6
- 速读区：11

## 今日简报（AI）
今天共整理17篇论文，重点集中在前沿大模型安全评测、RAG检索优化以及多智能体防护等方向。  
最值得关注的是“真实网络靶场中的AI能力评估”和“提示注入/代理通信攻击防护”两条主线，同时检索增强与重排序方法也有明显进展。  
普通读者可优先关注AI安全防护与企业级RAG系统的落地实践，以理解模型在真实环境中的风险与能力边界。

## 精读区
1. [AgentCyberRange：在真实网络靶场中对前沿人工智能系统的基准评测](/202606/18/2606.14295v2-agentcyberrange-benchmarking-frontier-ai-systems-in-realistic-cyber-ranges)（8.4/10）
   摘要：这篇论文试图回答“当前前沿 AI 是否已经具备自主执行真实网络攻击链的能力”。作者构建了一个开放可复现的网络攻防评测平台 AgentCyberRange，包含 110 个漏洞、15 个真实 Web 应用和 8 个企业级内网环境（156 台主机），并开发 CAGE 工具链统一调度与验证。实验显示 GPT\-5.5\+Codex 表现最佳，但在无提示条件下成功率仍只有 16.1%（Web）和 31.7%（后渗透），说明 AI 已具备非平凡攻击能力但距离全自动攻陷仍有较大差距。若关注 AI 安全、AI Agent 能力边界与网络安全风险演化，非常值得精读。
2. [uva\-irlab\-conv 在 SemEval\-2026 任务8中的工作：基于学习型稀疏检索与列表式重排序的多轮RAG](/202606/18/2606.11945v1-uva-irlab-conv-at-semeval-2026-task-8-multi-turn-rag-with-learned-sparse-retrieval-and-listwise-reranking)（8.2/10）
   摘要：本文是阿姆斯特丹大学参加 SemEval\-2026 Task 8（多轮RAG检索问答）的系统报告。作者构建了一个多阶段流水线：LLM对话查询改写→LION\-SP学习稀疏检索→点式重排→LLM列表式重排→RAG生成，并在全过程利用完整对话历史。结果显示该方案在检索任务中表现突出，38支队伍中获得第2名（nDCG@5=0.5475），但生成任务排名明显靠后，主要因为未显式处理不可回答问题。若关注多轮检索、稀疏检索和RAG系统设计，值得精读。
3. [ResAware：基于资源特权蒸馏的跨环境网站指纹识别](/202606/18/2606.17462v1-resaware-cross-environment-website-fingerprinting-via-resource-privileged-distillation)（8.2/10）
   摘要：提出ResAware，利用网页资源级结构作为特权信息训练教师模型，并通过知识蒸馏生成仅依赖加密流量的学生模型，用于提升跨环境网站指纹识别鲁棒性且无需额外在线能力，在多环境数据上验证可显著改善长期漂移下的识别性能，具有实用意义。
4. [FlowCLIP：利用域名进行加密流量分类的对比式预训练方法](/202606/18/2606.17746v1-flowclip-contrastive-pretraining-using-domain-names-for-encrypted-traffic-classification)（8.2/10）
   摘要：FlowCLIP提出基于CLIP的对比预训练，用包间隔/大小/方向等侧信道特征，将加密流量与域名表示对齐，冻结编码器进行线性分类，在QUIC按周划分评测中优于XGBoost与1NN等强基线，展现更强时间泛化能力，值得进一步细读。
5. [多源网络安全日志：ATT&CK标注数据集与SLM评估](/202606/18/2606.18190v1-multi-source-cybersecurity-logs-an-attck-labeled-dataset-and-slm-evaluation)（8.1/10）
   摘要：本文面向多阶段攻击跨系统、网络与浏览器日志关联难题，构建了一个 ATT&CK 细粒度标注的多源日志数据集，并用 LoRA 微调三种小语言模型做基准评测。结果显示数据集可显著提升攻击分块分类能力，但技术识别仍较难，整体更值得继续细读其数据构建与标注设计。
6. [PI\-Hunter：用于暴露与定位提示注入的自动化红队测试](/202606/18/2606.12737v1-pi-hunter-automated-red-teaming-for-exposing-and-localizing-prompt-injections)（8.0/10）
   摘要：提出PI\-Hunter，一种面向LLM智能体的自动化红队审计框架，用于主动暴露并定位提示注入漏洞，通过构造源感知测试用例与反馈驱动迭代探索，系统性触发外部环境中的潜在恶意指令传播路径。实验显示其在多基准、多攻击与多防御设置下显著提升漏洞暴露率与攻击面覆盖，并在现有防护下仍有效，适合用于精读安全与评测方法部分。

## 速读区
1. [CodeSentinel：一种面向代码上下文中间接提示注入的三层防御方法](/202606/18/2606.19235v1-codesentinel-a-three-layer-defense-against-indirect-prompt-injection-in-code-contexts)（7.9/10）
   摘要：本文提出CodeSentinel，用于防御代码上下文中的间接提示注入攻击。方法基于Tree\-sitter解析CST结构，对评论、字符串、标识符及decoy代码节点进行三层检测：语法预过滤、Min\-K%异常评分与节点扰动影响分析，并在推理阶段清洗高风险节点。实验覆盖六类攻击，在节点级F1约0.80优于多种基线，在自适应攻击下性能下降但仍保持较强鲁棒性，整体具备较高精读价值，尤其适合关注LLM代码安全方向。
2. [SAIGuard：用于LLM多智能体系统主动防御的通信状态仿真](/202606/18/2606.12474v1-saiguard-communication-state-simulation-for-proactive-defense-of-llm-multi-agent-systems)（7.8/10）
   摘要：SAIGuard针对LLM多智能体系统通信风险提出主动防御，利用交互图通信状态模拟与多层GNN预测消息对局部/全局影响，并结合正常通信重构偏差检测，在传播前拦截、净化或重生成消息，避免事后隔离带来的延迟与协作损失。实验表明其在多种拓扑与攻击场景降低攻击成功率并保持任务性能优于多基线，具有较高实用价值，值得精读。
3. [代理知晓过多：通过可验证可信执行环境封闭LLM API路由器](/202606/18/2606.16358v1-the-proxy-knows-too-much-sealing-llm-api-routers-with-attested-tees)（7.8/10）
   摘要：论文提出AEGIS，用可信执行环境\(TEE\)远程证明构建可验证API路由器，将数据路径限制在小型enclave内实现客户端验证的忠实透传，从根本消除LLM代理路由器的明文中间人风险。实验显示可阻断提示词篡改、工具调用注入与秘密窃取等攻击，并通过形式化验证与真实负载测试验证安全性与约6ms低开销，具有较强工程落地潜力，值得精读。
4. [面向CTI报告的多标签ATT&CK技术分类中开源大语言模型的评估](/202606/18/2606.18166v1-evaluating-open-source-llms-for-multi-label-attck-technique-classification-on-cti-reports)（7.8/10）
   摘要：本文评估开源大语言模型在CTI报告多标签ATT&CK技术分类任务中的表现，构建2076句、83份报告、114技术的标注数据集，并测试7种模型与53种配置。结果显示最佳F1仅0.22，模型规模与性能正相关但提示策略与温度影响不显著，整体表现较弱但建立了首个真实复杂CTI场景基线，适合关注安全与LLM结合方向的研究者参考。
5. [理解与缓解真实世界基于大语言模型（LLM）应用中的提示泄露攻击](/202606/18/2606.18673v1-understanding-and-mitigating-prompt-leaking-attacks-in-real-world-llm-based-applications)（7.8/10）
   摘要：本文系统研究真实LLM应用中的提示词泄露攻击，在6个平台1200个应用中发现80%以上存在系统提示泄露风险，并分析现有防御在真实场景中的失效机制。通过注意力层面的机制分析提出AREA软提示防御方法，可在不明显损害可用性的前提下显著增强抗泄露能力并降低优化开销，具有较强工程落地价值，值得进一步精读。
6. [SPARK：面向基于大语言模型的安全代码生成的安全知识预激活与表征引导的知识激活方法](/202606/18/2606.16244v1-spark-security-knowledge-priming-and-representation-guided-knowledge-activation-for-llm-based-secure-code-generation)（7.7/10）
   摘要：本文提出SPARK，用于提升大模型代码生成安全性，针对LLM已具备安全知识但未被有效激活的问题。方法通过检索CWE漏洞类别构造轻量提示，并结合基于安全方向向量的logit偏置，在不重新训练模型的情况下激活隐式安全表征。实验覆盖多模型与多语言，结果显示SPARK在安全性上优于或匹配多种微调与检索增强方法，同时几乎不影响代码功能性，具有较高实用价值，值得进一步精读方法细节。
7. [WHET：将同态加密与加速器架构深度融合](/202606/18/2606.11541v1-whet-welding-homomorphic-encryption-to-accelerator-architectures)（6.8/10）
   摘要：WHET面向CKKS全同态加密加速器的内存瓶颈问题，提出软硬件协同优化：通过细粒度CtS分解、明文结构压缩与中间ModRaise减少工作集与片外访问，并配合轻量硬件改造提升片上利用率。在SHARP8\+上实现1.38–8.74×面积性能提升、亚毫秒级bootstrapping及大幅加速的加密CNN推理，整体显示FHE可通过架构协同迈向实用化，值得进一步精读。
8. [T2S：一种基于回放的抗模型抽取攻击的模型水印方法](/202606/18/2606.11698v1-t2s-a-rehearsal-based-approach-for-extraction-resistant-model-watermarking)（6.8/10）
   摘要：本文提出T2S，一种基于rehearsal的模型水印方法，针对模型抽取攻击下水印易丢失的问题，通过模拟被盗模型并在触发集上计算损失，将梯度反馈回原模型进行水印微调，从而增强水印在被盗模型中的可迁移性与可检测性。实验显示该方法在多种抽取与后续水印移除攻击下均显著提升检测率，并保持较低误报率，同时无需依赖负样本模型，整体更稳定鲁棒，具备较高精读价值。
9. [Android 恶意软件世界中的隐形墨水：一项关于隐蔽通信通道使用情况的纵向研究](/202606/18/2606.13107v1-the-invisible-ink-of-the-android-malware-world-a-longitudinal-study-on-the-usage-of-covert-communication-channels)（6.8/10）
   摘要：本文面向安卓恶意软件中的隐蔽通信通道（VPN/Tor/代理等）长期演化问题，构建静态规则\+动态验证的分析管线，在350万样本中识别28.8万含CC样本并覆盖511个家族，揭示其使用率从2012年0.3%上升至2025年约50%，并指出现有检测方法对CC型恶意软件显著失效，整体具有较高阅读与复现参考价值。
10. [重新思考长视频中的 RAG：检索什么，以及如何利用检索结果？](/202606/18/2606.13141v1-rethinking-rag-in-long-videos-what-to-retrieve-and-how-to-use-it)（6.8/10）
   摘要：本文聚焦长视频RAG在检索与生成评估不可靠的问题，提出V\-RAGBench用于解耦检索与生成，并设计CARVE通过多模态与多粒度并行检索\+逐chunk自适应重排序选择最优配置，将结果交错输入生成器，在Ego4D等数据上显著优于现有VideoRAG基线，值得关注其评测与检索设计思想。
11. [CQC\-RAG：基于跨查询一致性的鲁棒检索增强生成](/202606/18/2606.13438v1-cqc-rag-robust-retrieval-augmented-generation-via-cross-query-consistency)（6.8/10）
   摘要：本文针对RAG系统中因查询表达差异导致检索结果不稳定、进而引发生成幻觉的问题，提出跨查询一致性假设，认为正确答案在语义等价但句法不同的查询下应表现出稳定置信度。基于此设计CQC\-RAG，通过语义保持的多查询改写、共享文档池重排序与跨查询置信稳定性评估来筛选答案，从而避免依赖解码随机性或单一检索视角。在多个开放域问答基准上取得显著提升（如TriviaQA与MuSiQue明显增益），无需外部监督，整体方法具有较强鲁棒性，值得继续精读。

---
使用键盘方向键可在日报/论文之间快速切换。
