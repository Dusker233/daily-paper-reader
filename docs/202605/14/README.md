# 日报 · 2026-05-14

- 生成时间：2026-05-14 21:38:50 UTC
- 当次推荐总数：12
- 精读区：1
- 速读区：11

## 今日简报（AI）
今天共浏览了 12 篇安全与AIoT相关论文，重点精读了入侵检测模型的泛化能力评估。  
值得关注的是，入侵检测模型的泛化性能和基于策略的LLM数据访问框架在AIoT安全中表现突出。  
建议普通读者关注模型在实际环境中的适应性与数据访问安全性，以理解未来安全技术趋势。

## 精读区
1. [评估入侵检测机器学习模型的泛化能力](/202605/14/2605.04407v1-assessing-generalisation-capability-of-machine-learning-models-for-intrusion-detection)（8.0/10）
   摘要：本文评估了机器学习模型在入侵检测任务中的泛化能力，针对UNSW\-NB15和TON\_IoT数据集，比较了随机森林、逻辑回归和朴素贝叶斯在同数据集与跨数据集测试中的表现。研究发现随机森林在单数据集上表现优异（准确率95%~99%），但跨数据集准确率骤降至40%以下，显示模型泛化存在显著差距。结论提示未来入侵检测需要自适应、可泛化的模型设计，值得精读以了解跨环境性能挑战与方法设计。

## 速读区
1. [SecureMCP：通过模型上下文协议在AIoT系统中实施策略控制的LLM数据访问框架](/202605/14/2605.05260v1-securemcp-a-policy-enforced-llm-data-access-framework-for-aiot-systems-via-model-context-protocol)（7.9/10）
   摘要：本文提出SecureMCP框架，针对AIoT环境中LLM生成SQL的安全问题，结合RBAC策略和MCP服务器实现多层防护。通过五个防御模块（策略检查、查询成本控制、危险模式拦截、风险等级过滤、数据库隔离）构建逐步闭锁管道，针对OWASP Top 10类型的提示注入攻击进行防御。实验表明，SecureMCP在保证SQL执行准确性的同时，对2400条对抗性查询实现82.3%的策略合规，防御失败率仅3.4%，适合进一步精读。
2. [使用领域适配语言模型进行威胁建模：实证评估与洞察](/202605/14/2605.10808v1-threat-modelling-using-domain-adapted-language-models-empirical-evaluation-and-insights)（7.9/10）
   摘要：本文针对结构化威胁建模任务（STRIDE分类），系统评估了领域适配的语言模型（LLMs和SLMs）在5G安全场景下的表现。作者比较了领域适配与通用模型、不同模型规模、解码策略及提示工程对威胁分类的影响。实验结果显示，领域适配模型并非总优于通用模型，较大模型表现更好但不稳定，提示改进需结合任务特定推理与安全概念。该研究为评估LLM在威胁建模的可靠性提供了实证依据，值得精读以深入理解方法与局限。
3. [基于信息时效性的客户端选择用于云边安全分析中的稳健及时联邦入侵检测](/202605/14/2605.05644v1-aoi-guided-client-selection-for-robust-and-timely-federated-intrusion-detection-in-cloud-edge-security-analytics)（7.8/10）
   摘要：本文提出了一种基于信息时效性\(AoI\)的客户端选择框架，用于云\-边协作的联邦入侵检测系统\(Fed\-IDS\)。通过引入AoI优先、效用优先及混合策略，论文在多数据集和多威胁场景下验证了该方法能显著降低平均和峰值AoI，同时在宏观F1和AUC上保持或提升性能。研究表明，轻量化调度层可在不增加通信负担的情况下提升检测时效性，适合快速评估是否深入研究。
4. [LCC\-LLM：利用以代码为中心的大型语言模型进行恶意软件归因](/202605/14/2605.05807v1-lcc-llm-leveraging-code-centric-large-language-models-for-malware-attribution)（7.8/10）
   摘要：本文提出LCC\-LLM，一种面向代码的LLM框架及大规模代码中心化数据集（LCCD），用于恶意软件归属与静态分析。通过反编译C代码、汇编、CFG/FCG、PE元数据及API证据等多维特征，并结合LangGraph静态分析、多源威胁情报、验证链和质量门控，实现证据驱动的分析。实验显示在43类任务上平均语义相似度0.634，真实样本评测达到10/10结构化分析通过率，显著提升归属可靠性和可操作性，值得继续精读。
5. [LeakDojo：解码 RAG 系统的泄露威胁](/202605/14/2605.05818v1-leakdojo-decoding-the-leakage-threats-of-rag-systems)（7.8/10）
   摘要：本论文针对 Retrieval\-Augmented Generation \(RAG\) 系统的知识泄露风险提出了 LeakDojo 框架，用于系统评估和分析泄露威胁。作者通过对 14 种 LLM、4 个数据集和多种 RAG 系统的实验，发现查询生成器和对抗指令独立影响泄露，强指令遵循能力与泄露风险正相关，同时 RAG 可靠性提升可能增加泄露风险。这些结果为理解和缓解 RAG 泄露提供了实践指导，值得对泄露机制与防御策略精读。
6. [GESR：基于图的边语义重构用于仅良性训练下的隐蔽通信检测](/202605/14/2605.07536v1-gesr-graph-based-edge-semantic-reconstruction-for-stealthy-communication-detection-with-benign-only-training)（7.8/10）
   摘要：本论文针对在仅使用正常流量训练情况下检测隐蔽恶意通信的难题，提出了GESR框架。该方法通过将网络通信建模为图结构，并从局部邻居上下文重建边语义，捕获微妙的结构异常。实验证明，在CTU\-13和CICIDS2017数据集上，GESR在严格低误报约束下表现优异，ROC\-AUC高达0.9753，显示其在实际入侵检测场景中具有潜力。对于关注隐蔽通信检测的研究者，论文值得精读。
7. [FedSurrogate：通过层关键性与替代更新在联邦学习中防御后门攻击](/202605/14/2605.11122v1-fedsurrogate-backdoor-defense-in-federated-learning-via-layer-criticality-and-surrogate-replacement)（6.9/10）
   摘要：本论文针对联邦学习中的后门攻击提出FedSurrogate防御方法，通过识别关键层（Layer Criticality Analysis）、双向梯度对齐筛选（bidirectional soft\-filtering）以及恶意更新的替代更新（surrogate replacement），有效降低误报率并保持全局模型精度。实验证明在非IID数据和多种攻击场景下，FedSurrogate将误报率控制在10%以下，攻击成功率低于2.1%，显示出显著优于现有方法的性能，值得进一步精读。
8. [A Pragmatic Comparison of Cryptographic Computation Technologies for Machine Learning](/202605/14/2605.04858v1-a-pragmatic-comparison-of-cryptographic-computation-technologies-for-machine-learning)（6.8/10）
   摘要：本文对两种主要的安全计算技术——安全多方计算（SMPC）和全同态加密（FHE）在机器学习中的应用进行了实用比较。通过理论总结和开源软件框架分析，并结合广泛的性能基准测试，研究揭示了FHE在回归任务和简单密集网络中可能优于SMPC，而SMPC在复杂模型如卷积神经网络上表现更佳。研究为技术选择提供了数据支撑，对从业者有较高参考价值，值得精读。
9. [存储非记忆：以检索为中心的智能体回忆架构](/202605/14/2605.04897v1-storage-is-not-memory-a-retrieval-centered-architecture-for-agent-recall)（6.8/10）
   摘要：本论文提出True Memory，一种以检索为中心的多层代理记忆架构，替代传统的存储先行方法，通过在摄取阶段保留事件原文并在查询时进行多阶段检索，实现更高的记忆召回率。在多套基准测试（LoCoMo、LongMemEval、BEAM\-1M）中，True Memory在无需GPU或外部数据库的情况下表现接近或优于现有系统。若你关注高效、可扩展的代理记忆设计，该文值得精读。
10. [Heimdallr：在 GitHub CI 工作流中表征与检测由大型语言模型引发的安全风险](/202605/14/2605.05969v1-heimdallr-characterizing-and-detecting-llm-induced-security-risks-in-github-ci-workflows)（6.8/10）
   摘要：本文研究了GitHub CI工作流中集成大语言模型（LLM）可能带来的安全风险，提出了Heimdallr分析框架，通过构建LLM\-Workflow属性图、触发性分析及数据流总结，实现对风险路径的检测。实验在300个手工标注的工作流上显示高准确率（LLM节点识别F1=0.994，威胁向量检测F1=0.917），并已披露802个漏洞实例。论文提供了首次系统化的风险分类和检测方法，值得安全和CI自动化研究者深入阅读。
11. [重新审视不确定性：面向部分相关视频检索的证据学习](/202605/14/2605.06083v1-revisiting-uncertainty-on-evidential-learning-for-partially-relevant-video-retrieval)（6.8/10）
   摘要：本文针对部分相关视频检索（PRVR）问题，提出了 Holmes 框架，通过分层证据学习显式建模查询与视频内容间的不确定性。在视频间层面，使用 Dirichlet 分布解释相似度并进行三重原则的查询识别与标签校准；在视频内层面，引入柔性最优传输进行软对齐以缓解稀疏监督。实验显示 Holmes 在多个基准上超越现有方法，值得继续精读方法设计与实验分析部分。

---
使用键盘方向键可在日报/论文之间快速切换。
