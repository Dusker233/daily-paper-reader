<div class="dpr-home-notice-card">
  <h3 class="dpr-home-notice-title">🚀 Start Here</h3>
  <ul class="dpr-home-notice-list">
    <li><a href="#/tutorial/README">使用教程</a></li>
  </ul>
</div>

## 每次日报
- 最新运行日期：2026-04-20
- 运行时间：2026-04-20 20:29:19 UTC
- 运行状态：成功
- 本次总论文数：16
- 精读区：5
- 速读区：11

### 今日简报（AI）
今天成功完成了16篇文章的阅读，其中精读5篇，速读11篇。  
重点推荐《Towards Automated Pentesting with Large Language Models》与《Optimizing IoT Intrusion Detection with Tabular Foundation Models for Smart City Forensics》，这两篇为网络安全和物联网检测领域提供了重要洞察。  
建议关注智能城市与网络安全的结合，尤其是如何利用大型语言模型提升渗透测试和入侵检测的自动化水平。
- 详情：[/202604/20/README](/202604/20/README)

### 精读区论文标签
1. [Towards Automated Pentesting with Large Language Models](/202604/20/2604.11772v1-towards-automated-pentesting-with-large-language-models)  
   标签：评分：8.5/10、query:q9
   摘要：本文提出 RedShell 框架，利用本地微调的大型语言模型（LLMs）自动生成用于 Windows 漏洞测试的恶意 PowerShell 代码，实现渗透测试流程的自动化。实验显示生成代码在语法有效性超过 90%，与参考代码的语义相似度超过 50%，并在受控环境下执行可靠，说明方法具有实用潜力，值得进一步精读了解其实现和评估细节。
   evidence：LLM应用于网络安全的渗透测试框架。
2. [Optimizing IoT Intrusion Detection with Tabular Foundation Models for Smart City Forensics](/202604/20/2604.11394v1-optimizing-iot-intrusion-detection-with-tabular-foundation-models-for-smart-city-forensics)  
   标签：评分：8.2/10、query:q9
   摘要：本文针对智能城市物联网环境中的入侵检测提出利用TabPFNv2.5表格基础模型提升实时威胁响应效率的方法。研究表明，相比随机森林，TabPFNv2.5推理速度快40倍，同时二分类准确率仍达97%。论文还提出混合管道方案，用快速模型进行初筛，精细分类由传统集成模型完成，兼顾速度与准确性。对于智能城市安全操作与快速取证场景具有实用参考价值，值得精读。
   evidence：使用LLMs进行物联网入侵检测和网络安全的研究
3. [Latent Instruction Representation Alignment: defending against jailbreaks, backdoors and undesired knowledge in LLMs](/202604/20/2604.10403v1-latent-instruction-representation-alignment-defending-against-jailbreaks-backdoors-and-undesired-knowledge-in-llms)  
   标签：评分：8.0/10、query:q9
   摘要：本文提出 Latent Instruction Representation Alignment (LIRA) 方法，针对大型语言模型的越狱、后门和不良知识问题，通过改变模型对指令的内部表示而非输出行为，实现更强泛化的安全防护。实验显示，LIRA 能阻挡 99% 以上 PEZ 越狱攻击，移除复杂后门，并实现高效的有害知识遗忘，同时对正常功能影响极小，值得继续精读其方法与实验细节。
   evidence：LLM指令对齐用于防越狱与后门安全防护
4. [Structure-Grounded Knowledge Retrieval via Code Dependencies for Multi-Step Data Reasoning](/202604/20/2604.10516v1-structure-grounded-knowledge-retrieval-via-code-dependencies-for-multi-step-data-reasoning)  
   标签：评分：8.0/10、query:profile-1
   摘要：本文提出SGKR方法，针对多步数据分析中传统基于语义相似度的检索难以提供关键计算知识的问题，将领域知识绑定到函数并构建代码调用依赖图，通过输入输出语义标签定位相关函数，再沿依赖路径检索子图作为LLM生成上下文。实验表明该方法在多个数据分析基准上相比无检索与语义检索均显著提升答案正确率，同时减少上下文冗余，整体思路清晰且工程价值较强，值得进一步细读。
   evidence：基于结构的知识检索用于LLM任务
5. [Clustering-Enhanced Domain Adaptation for Cross-Domain Intrusion Detection in Industrial Control Systems](/202604/20/2604.12183v1-clustering-enhanced-domain-adaptation-for-cross-domain-intrusion-detection-in-industrial-control-systems)  
   标签：评分：8.0/10、query:q4
   摘要：本文针对工业控制系统中跨域入侵检测面临的数据稀缺、流量分布差异和未知攻击问题，提出了一种聚类增强的域适应方法。通过特征迁移学习和K-Medoids聚类结合PCA降维，该方法在源域和目标域间实现分布对齐并提升跨域相关性估计。实验显示其在未知攻击检测上准确率提高最多49%，F-score显著提升，并具有较强稳定性，表明值得继续精读。
   evidence：处理动态流量环境中的入侵检测，涉及加密流量分类。

### 速读区论文标签
1. [FAST: A Synergistic Framework of Attention and State-space Models for Spatiotemporal Traffic Prediction](/202604/20/2604.13453v1-fast-a-synergistic-framework-of-attention-and-state-space-models-for-spatiotemporal-traffic-prediction)  
   标签：评分：7.9/10、query:q7
   摘要：本文提出 FAST 框架，结合时间注意力和 Mamba 状态空间模型，用于大规模交通网络的时空预测。通过 Temporal-Spatial-Temporal 架构和多源时空嵌入，模型兼顾短期波动与长期依赖，同时保持线性计算复杂度。实验证明，FAST 在 PeMS04、PeMS07、PeMS08 数据集上均优于 Transformer、GNN 和单独状态空间模型，表现出较好的准确性、可扩展性与泛化能力，值得进一步精读。
   evidence：用于时空流量预测的模型，可与网络流量理解相关。
2. [AnomalyGen: Enhancing Log-Based Anomaly Detection with Code-Guided Data Augmentation](/202604/20/2604.11107v1-anomalygen-enhancing-log-based-anomaly-detection-with-code-guided-data-augmentation)  
   标签：评分：7.8/10、query:q7
   摘要：本研究提出AnomalyGen框架，通过从源代码合成标记日志序列来增强日志异常检测中的训练数据，从而解决了现有公共基准数据集覆盖率低的问题。实验结果表明，该方法在多个异常检测模型上均显著提升了性能，值得进一步关注与研究。
   evidence：LLM推理用于日志流量分析
3. [MCPThreatHive: Automated Threat Intelligence for Model Context Protocol Ecosystems](/202604/20/2604.13849v1-mcpthreathive-automated-threat-intelligence-for-model-context-protocol-ecosystems)  
   标签：评分：7.8/10、query:q9
   摘要：MCPThreatHive is an open-source platform designed to automate the end-to-end lifecycle of Model Context Protocol (MCP) threat intelligence. It addresses key security gaps in MCP ecosystems by automating threat data collection, AI-driven analysis, and interactive visualization, offering a composite risk scoring model. The platform highlights gaps in existing MCP security tools, such as incomplete attack modeling and lack of continuous threat intelligence. This paper is useful for those exploring security in MCP-based systems but may require further investigation into practical implementations。
   evidence：该平台自动化了安全协议的威胁情报，与网络安全和流量分析相关
4. [Adaptive Query Routing: A Tier-Based Framework for Hybrid Retrieval Across Financial, Legal, and Medical Documents](/202604/20/2604.14222v1-adaptive-query-routing-a-tier-based-framework-for-hybrid-retrieval-across-financial-legal-and-medical-documents)  
   标签：评分：7.8/10、query:profile-1
   摘要：本文提出了一种面向金融、法律和医疗文档的自适应查询路由框架（AHR），比较了向量检索、树状推理和混合检索三种RAG架构，并引入四层查询复杂度基准。实验表明，不同架构在不同查询层次表现差异明显，混合AHR在交叉引用和多部分查询上表现最佳，Tree Reasoning整体得分最高。结果支持根据查询复杂度动态选择检索策略的系统设计，值得进一步精读以理解跨域适应性。
   evidence：用于LLM基础的RAG混合检索
5. [Demonstration of Pneuma-Seeker: Agentic System for Reifying and Fulfilling Information Needs on Tabular Data](/202604/20/2604.14422v1-demonstration-of-pneuma-seeker-agentic-system-for-reifying-and-fulfilling-information-needs-on-tabular-data)  
   标签：评分：7.8/10、query:profile-1
   摘要：本论文介绍了 Pneuma-Seeker 系统，旨在支持数据分析过程中用户信息需求的迭代明确化和可检查化。系统通过将用户当前信息需求 I+ 转化为显式关系规范，使数据发现和处理可追踪和可验证。通过两个采购场景的演示，论文展示了系统如何利用 LLM 作为交互式分析协作者而非黑箱答案引擎，从而提高信息需求满足的精度和透明度。值得关注数据分析自动化和交互式系统的读者可进一步精读。
   evidence：LLM辅助的迭代数据分析
6. [SecureRouter: Encrypted Routing for Efficient Secure Inference](/202604/20/2604.15499v1-securerouter-encrypted-routing-for-efficient-secure-inference)  
   标签：评分：7.8/10、query:q9
   摘要：本论文提出 SecureRouter，一种面向加密环境下高效 Transformer 推理的输入自适应模型路由框架，通过结合 MPC 优化的模型池和加密路由器，实现不同输入选择最合适模型以平衡效率与准确率。实验显示，与固定模型的 MPC 推理相比，SecureRouter 在保持几乎无精度损失的情况下，推理延迟降低约 1.95 倍，显示其在隐私保护 AI 推理中的实际应用潜力，值得深入阅读。
   evidence：加密路由与类似LLM的自适应推理
7. [SAGE: Selective Attention-Guided Extraction for Token-Efficient](/202604/20/2604.15583v1-sage-selective-attention-guided-extraction-for-token-efficient)  
   标签：评分：6.9/10、query:profile-1
   摘要：本论文提出了 SAGE，一种无需训练、可插拔的长文档上下文压缩框架，通过轻量级本地 LLM 将注意力信号转换为查询相关热力图，并在用户设定的 token 预算下提取最相关文本单元，实现上下文大幅度压缩。实验表明，在多个长文档问答基准上，SAGE 在仅使用 10% 上下文的情况下仍取得竞争性准确率，显示其在效率与准确性之间取得良好平衡，值得对长文档问答和模型推理优化方向感兴趣的读者精读。
   evidence：LLM用于异构问答的上下文压缩
8. [RECIPER: A Dual-View Retrieval Pipeline for Procedure-Oriented Materials Question Answering](/202604/20/2604.11229v1-reciper-a-dual-view-retrieval-pipeline-for-procedure-oriented-materials-question-answering)  
   标签：评分：6.8/10、query:profile-1
   摘要：本研究提出了RECIPER，一个双视图检索管道，通过结合段落级上下文与LLM提取的程序摘要来提高材料科学领域的问题回答能力。实验表明，该方法在多个指标上均优于传统段落仅密集检索，值得进一步细读以了解其具体实现与应用潜力。
   evidence：LLM双视图检索展示了集成检索与推理方法
9. [Evaluating Lightweight Block Cipher Payload Encryption for Real-Time CAN Traffic](/202604/20/2604.11853v1-evaluating-lightweight-block-cipher-payload-encryption-for-real-time-can-traffic)  
   标签：评分：6.8/10、query:q4
   摘要：本研究评估了将轻量级区块密码负载加密集成到实时CAN节点的可行性，旨在防止通过统计分析和观察推测信号含义的语义反向工程攻击。实验表明，采用Speck加密算法后，负载加密有效地隐藏了常量值和信号模式，同时保持100Hz的实时传输调度。此发现证明了轻量级负载加密能够在资源受限的硬件上减少基于观察的攻击，但对于其他类型的攻击保护效果尚待评估。值得继续精读，尤其是加密算法的时间影响与数据模式的可观察性部分。
   evidence：使用轻量级分组密码进行加密CAN流量分类
10. [Latent-Condensed Transformer for Efficient Long Context Modeling](/202604/20/2604.12452v2-latent-condensed-transformer-for-efficient-long-context-modeling)  
   标签：评分：6.8/10、query:q3
   摘要：本研究提出了一种新的注意力机制——潜在压缩注意力（LCA），旨在解决大语言模型在处理长文本时面临的计算复杂性和内存开销问题。通过将上下文直接压缩到潜在空间中，LCA实现了显著的速度提升和内存节省，同时保持了良好的性能。这一创新方法值得深入研究与应用。
   evidence：LLM用于改善长上下文建模。
11. [LLM-Driven Large-Scale Spectrum Access](/202604/20/2604.13132v1-llm-driven-large-scale-spectrum-access)  
   标签：评分：6.8/10、query:q3
   摘要：本文提出了一种基于大语言模型（LLM）的超大规模频谱接入框架（LSA），通过组相对策略优化（GRPO）和分层状态序列化机制解决大规模无线网络中频谱管理的计算复杂性问题。实验显示该方法在严格时间限制下，能保持稳定的频谱利用率和良好的扩展性，性能优于传统启发式算法和分区经典求解器，值得深入研究其方法设计与实验验证。
   evidence：用于网络频谱管理的LLM驱动推理


<div class="dpr-home-promo-card">
  <h3 class="dpr-home-promo-title">💬 社区与支持</h3>
  <ul class="dpr-home-promo-list">
    <li>欢迎 Star / Fork / Issue / PR</li>
    <li>QQ群：583867967（欢迎交流，已有：1151人）</li>
  </ul>
</div>

<!--dpr-seed-papers:start-->
## Seed Papers
- [Latest: Wan et al.   2025   CATO End to end optimization of ML based traffic analysis pipelines](/seed-papers/1776760574807/index)
<!--dpr-seed-papers:end-->
