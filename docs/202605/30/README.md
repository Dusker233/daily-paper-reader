# 日报 · 2026-05-30

- 生成时间：2026-05-30 21:03:24 UTC
- 当次推荐总数：15
- 精读区：4
- 速读区：11

## 今日简报（AI）
5月30日聚焦网络安全 AI：重点阅读了智能体自进化（CyberEvolver）与网络安全数据集（CAI Dataset）两大方向，并快速扫描了恶意软件检测、对抗样本与 RAG 防御等前沿工作。  
最值得关注的是“安全智能体持续进化能力”和“高质量网络安全数据集建设”，两者均获 8.2/10 评分，是推动安全 AI 落地的关键基础。  
建议优先了解 AI 在网络攻防中的实际应用场景，同时关注数据质量与模型安全防护，这将是未来安全技术发展的核心主线。

## 精读区
1. [CyberEvolver：面向网络安全智能体的在线结构化自进化框架](/202605/30/2605.26195v1-cyberevolver-structured-self-evolution-for-cybersecurity-agents-on-the-fly)（8.2/10）
   摘要：论文提出 CyberEvolver，探索网络安全智能体能否在执行过程中基于失败经验自动改进自身 Scaffold，而非依赖固定人工设计框架。作者设计四层可演化架构、执行轨迹到诊断信号的转换机制，以及保持多样性的群体束搜索进化策略，在 CTF、漏洞利用和渗透测试任务上持续迭代优化。实验显示平均成功率较初始智能体提升13.6%，并超过多种人工设计和现有自改进方法。若关注 Agent 自进化、网络安全自动化或测试时优化方向，值得进一步精读。
2. [网络安全人工智能（CAI）数据集](/202605/30/2605.28146v1-cybersecurity-ai-cai-dataset)（8.2/10）
   摘要：论文发布 CAI Dataset，一个持续14个月收集的网络安全大模型使用轨迹语料库，目标是解决网络安全专用LLM缺乏真实专家操作轨迹的问题。数据来自CAI代理框架，覆盖23万会话、2600万提示词、4187种模型调用与大量真实攻防场景。作者认为其规模和真实性均超过现有公开数据集，并强调远程API模式带来的数据集中化风险。若关注网络安全LLM训练数据、Agent轨迹学习或私有化模型建设，值得进一步细读。
3. [重新思考 Agentic RAG：迈向超越嵌入的、由大语言模型驱动的逻辑检索](/202605/30/2605.27123v1-rethinking-agentic-rag-toward-llm-driven-logical-retrieval-beyond-embeddings)（8.0/10）
   摘要：本文提出了一种以大语言模型（LLM）为主导的逻辑检索框架（Logical RAG），旨在替代传统依赖嵌入或图结构的复杂检索系统，通过让LLM生成精确的逻辑查询并在倒排索引后端执行，实现多轮迭代查询和精确检索。实验显示该方法在匹配强基线的同时，显著降低了系统构建和服务成本，并减少了生成内容中的幻觉。论文值得关注，尤其是逻辑检索对多轮问答性能和成本优化的影响。
4. [Entity\-Collision：一种用于归因智能体记忆检索增益的分层协议](/202605/30/2605.29630v1-entity-collision-a-stratified-protocol-for-attributing-retrieval-lift-in-agent-memory)（8.0/10）
   摘要：论文关注Agent Memory检索评测中的归因失真问题：现有hit@k同时混杂实体词重叠带来的BM25优势和不同记忆类型混合统计。作者提出Entity\-Collision协议，通过让干扰项与答案共享实体词、并按标签分层评测，固定BM25基线，从而测量真正来自Embedding的增益。实验显示检索效果存在明显“词汇型\-意图型”双轴差异，MiniLM整体最稳健，更大参数模型并非总更优。若关心Agent Memory评测方法与检索器选型，值得细读。

## 速读区
1. [基于自监督学习与强化学习的 Android 恶意软件检测中的概念漂移自适应](/202605/30/2605.24294v1-concept-drift-adaptation-using-self-supervised-and-reinforcement-learning-in-android-malware-detection)（7.8/10）
   摘要：论文关注 Android 恶意软件检测中的概念漂移导致部署后性能衰减问题，提出将自监督学习与强化学习结合的维护框架。先用 SSL 学习稳定潜表示并冻结编码器，再通过轻量适配器和分类头进行增量更新，同时利用 PPO 控制器根据漂移、保留能力和维护成本选择更新动作。实验在模拟器和真实数据集、静态与动态特征上评估，结果表明该方法能在性能、记忆保留与维护成本之间取得较优平衡。若关注长期部署与低成本维护，值得进一步细读。
2. [按家族和类型构建对抗性恶意软件数据集：生成、规避与中毒评估](/202605/30/2605.25937v1-building-an-adversarial-malware-dataset-by-family-and-type-generation-evasion-and-poisoning-evaluation)（7.8/10）
   摘要：论文旨在填补大规模真实对抗恶意软件数据集的空白。作者基于 RawMal\-TF 真实 PE 恶意样本，利用多种对抗样本生成器构建家族标签与类型标签两套对抗数据集，并评估逃逸能力与数据投毒风险。结果显示对 EMBER 分类器的逃逸率分别达到 98.35% 和 92.20%，且仅注入 0.5% 完全错标对抗样本即可显著削弱模型鲁棒性。若关注对抗恶意软件、鲁棒检测或数据投毒问题，值得继续精读。
3. [Cordon\-MAS：通过信息流控制防御 RAG 的知识投毒攻击](/202605/30/2605.26754v1-cordon-mas-defending-rag-against-knowledge-poisoning-via-information-flow-control)（7.8/10）
   摘要：本文针对检索增强生成（RAG）系统在高风险应用中易受知识投毒攻击的问题，提出了Cordon\-MAS框架，通过信息流控制与多代理结构实现Cordon原则，即禁止最终生成代理直接访问未经验证的自然语言证据。实验证明，该方法在五个BEIR数据集上将攻击成功率降低92.4%，表明从检测问题转向信息流控制可以显著增强RAG安全性，值得继续精读以理解架构设计与安全机制。
4. [Cloak：通过固定时间分布实现启发式 ORAM 优化](/202605/30/2605.27565v1-cloak-heuristic-oram-optimization-through-fixed-temporal-distribution)（7.8/10）
   摘要：本文提出 Cloak，一种利用访问模式的时间局部性优化 ORAM 性能的启发式存储系统。通过让服务器访问遵循固定的“近期偏向”分布，Cloak 能在保证安全的前提下大幅减少虚假查询开销，实现接近非加密基线的性能。实验显示在 Netflix 和 Ethereum 数据上，单机可分别达到 165,000 和 157,000 次操作每秒。对于关注高效安全云存储的读者，值得进一步精读。
5. [基于检索增强生成与大语言模型的 SDN 中 Carpet\-Bombing DDoS 攻击智能检测与缓解](/202605/30/2605.26307v1-intelligent-detection-and-mitigation-of-carpet-bombing-ddos-attacks-in-sdn-using-retrieval-augmented-generation-and-large-language-models)（7.7/10）
   摘要：该论文针对 SDN 环境中难以被传统方法识别的 Carpet\-Bombing DDoS 攻击，提出一种结合 RAG 与大语言模型的实时检测与缓解框架。方法通过接口级流量特征表示、语义嵌入、FAISS 相似检索和 LLM 上下文推理，实现无需监督训练或反复重训的攻击识别，并比较 JSON 与自然语言两种流量表示方式。实验显示 Gemma\-4\-31B\-IT 配置检测效果最佳，且具备实时缓解能力。若关注“零训练”网络安全检测或 LLM 在 SDN 安全中的应用，值得继续细读。
6. [APT\-Agent：利用大型语言模型的自动化渗透测试](/202605/30/2605.24949v1-apt-agent-automated-penetration-testing-using-large-language-models)（7.6/10）
   摘要：本文提出了APT\-Agent，一个基于大型语言模型\(LLM\)的自动化渗透测试框架，通过引入命令纠正模块和阶段感知的上下文管理模块，实现了多步骤攻击流程的高效执行。在Metasploitable 2实验中，APT\-Agent在七类服务上达成84.29%的端到端利用成功率，明显优于现有LLM和脚本化方法。该研究展示了LLM在渗透测试自动化中的可行性与效率提升，值得精读以了解实现细节与实用潜力。
7. [五次查询已足够：基于蕴含关系的面向 RAG 的高查询效率、无代理模型成员推断攻击](/202605/30/2605.24312v1-five-queries-are-enough-query-efficient-and-surrogate-free-membership-inference-attacks-on-rag-via-entailment)（6.8/10）
   摘要：本文研究RAG系统中的成员推断攻击（MIA）能否在极低查询预算下实现。作者提出MEntA，通过生成少量自然语言信息查询，并利用自然语言蕴含（NLI）度量模型回答与候选文档之间的蕴含关系，无需影子模型和固定模板。实验显示仅用5次查询即可在多个数据集上达到最高0.991 AUC，并在多种RAG防御下保持较强攻击效果，同时显著降低成本。若关注RAG隐私安全与推断攻击，该文值得细读。
8. [通过平衡学习、可靠伪标签与轻量化架构增强物联网自主在线入侵检测](/202605/30/2605.26166v1-enhancing-autonomous-online-intrusion-detection-for-iot-with-balanced-learning-reliable-pseudo-labels-and-lightweight-architectures)（6.8/10）
   摘要：本文针对物联网\(IoT\)设备入侵检测系统\(IDS\)在在线、自主学习环境下的适应性和轻量化需求，分析并复现了AOC\-IDS方法，识别其在类别不平衡、伪标签可靠性、泛化能力及计算开销上的局限，并提出XGBoost\-BalSamp与组合深度学习改进\(PseudoFilter\+MixupAug\+LiteAE\)，在UNSW\-NB15数据集上分别达到了95.45%和90.88%精度，同时减小模型参数55%。研究展示了改进方法在精度和可部署性上的优势，值得关注IoT安全的读者精读。
9. [BitC\-3DGS：通过比特压缩实现高容量的 3D 高斯泼溅水印](/202605/30/2605.29583v1-bitc-3dgs-high-capacity-3d-gaussian-splatting-watermarking-via-bit-compression)（6.8/10）
   摘要：论文针对3D Gaussian Splatting语义水印容量受CLIP文本编码器77\-token限制的问题，提出BitC\-3DGS。核心做法是将多个比特压缩映射到单个语义token，通过位压缩分词、双分支解码器（chunk级\+bit级）以及困难消息采样策略实现高容量嵌入与可靠恢复。实验显示其可支持128\-bit水印容量，并保持与现有64\-bit方案相当的解码准确率和渲染质量。若关注3D资产版权保护与高容量水印设计，值得进一步细读。
10. [有限标注条件下的大语言模型选择](/202605/30/2605.24981v1-large-language-model-selection-with-limited-annotations)（6.8/10）
   摘要：论文提出SELECT\-LLM，旨在解决在标注预算极其有限时如何从大量候选大语言模型中可靠选出最佳模型的问题。方法基于主动模型选择思想，通过候选模型输出之间的两两相似度近似计算信息增益，迭代挑选最有价值的查询进行人工标注。实验覆盖23个数据集、156个模型和多种任务类型，在最佳模型和近最佳模型选择上均显著降低标注成本，最高节省超过80%。如果关注LLM评测、模型选型或低成本评估，值得进一步细读。
11. [DocRetriever：一个即插即用的多模态文档检索框架及其综合基准测试](/202605/30/2605.30027v1-docretriever-a-plug-and-play-framework-for-multimodal-document-retrieval-with-comprehensive-benchmark)（6.8/10）
   摘要：论文聚焦多模态文档检索中视觉嵌入语义粗粒度、重排序泛化差以及评测基准不足的问题，提出可插拔框架 DocRetriever。核心做法是在现有 VLM 检索器上增加布局感知稀疏表示形成混合检索，并利用推理增强示例的 ICL 重排序提升跨域泛化，同时构建 MultiDocR 基准。实验显示混合编码相较纯稠密检索稳定提升检索指标，并带来下游 RAG 效果增益。若关注文档检索、RAG 或视觉检索系统优化，值得继续细读。

---
使用键盘方向键可在日报/论文之间快速切换。
