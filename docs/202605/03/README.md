# 日报 · 2026-05-03

- 生成时间：2026-05-03 20:01:08 UTC
- 当次推荐总数：17
- 精读区：6
- 速读区：11

## 今日简报（AI）
今天完成了17篇文章的阅读，其中6篇精读，11篇速读。推荐关注《Toward Autonomous SOC Operations》和《OpenSOC\-AI》在安全运维和日志分析方面的深入探讨。建议继续关注LLM在安全检测和分析领域的最新应用，特别是恶意软件检测的创新方法。

## 精读区
1. [迈向自主化SOC运维：用于安全运维中威胁检测、查询生成与响应的端到端大语言模型框架](/202605/03/2604.27321v1-toward-autonomous-soc-operations-end-to-end-llm-framework-for-threat-detection-query-generation-and-resolution-in-security-operations)（8.5/10）
   摘要：本文提出了一种面向安全运营中心（SOC）的端到端框架，结合集成型大语言模型\(LLM\)威胁检测、语法约束查询生成\(SQM\)和基于证据的事件响应推荐，旨在自动化传统手工流程。实验证明，该方法在SIEM日志上检测准确率达82.8%，查询生成性能提升超过2倍，并将事件处理平均时间从数小时缩短至10分钟以内。论文值得精读，尤其对希望提升SOC自动化和LLM应用的研究者有参考价值。
2. [OpenSOC\-AI：通过参数高效的LLM日志分析实现安全运维的民主化](/202605/03/2604.26217v1-opensoc-ai-democratizing-security-operations-with-parameter-efficient-llm-log-analysis)（8.2/10）
   摘要：本论文提出OpenSOC\-AI，面向中小企业的轻量级安全日志分析框架，通过对1.1亿参数TinyLlama模型进行参数高效的LoRA微调，实现威胁分类、MITRE ATT&CK映射和严重性评估。在仅450条领域样本和单张T4 GPU下训练五分钟内，威胁分类准确率提升68个百分点，严重性准确率提升30个百分点，F1达0.68，显示了小模型在资源受限环境下的可行性，值得关注模型微调策略和实用部署。
3. [预算受限的在线检索增强生成：Chunk\-as\-a\-Service模型](/202605/03/2604.26981v1-budget-constrained-online-retrieval-augmented-generation-the-chunk-as-a-service-model)（8.2/10）
   摘要：本文提出了Chunk\-as\-a\-Service \(CaaS\)模型，旨在解决RAG\-as\-a\-Service \(RaaS\)存在的成本不透明和效率低的问题。通过引入Open\-Budget和Limited\-Budget两种变体，以及在线选择算法UCOSA，实现按相关性和预算优化提示增强。实验显示UCOSA在提升增强提示相关性和预算利用率上明显优于随机和贪心方法，且具有较高成本效益，值得进一步精读以理解算法机制和经济模型设计。
4. [在加密数据上训练机器学习模型：基于同态加密的隐私保护框架](/202605/03/2604.23245v1-training-machine-learning-models-on-encrypted-data-a-privacy-preserving-framework-using-homomorphic-encryption)（8.0/10）
   摘要：This paper explores a privacy\-preserving framework for training machine learning \(ML\) models on encrypted data using homomorphic encryption. The authors propose a proof\-of\-concept based on Cheon\-Kim\-Kim\-Song \(CKKS\) encryption to support approximate real\-number operations for models like KNN, linear regression, and MLP. Experimental results show that homomorphic encryption allows for effective training with performance comparable to plaintext models. However, challenges like computational overhead and noise management persist. This work is crucial for advancing privacy\-preserving ML, with potential real\-world applications in sensitive data handling. Worth reading if you're interested in ML security and encryption techniques。
5. [DYMAPIA：一种用于检测基于AI的视频篡改的多领域框架](/202605/03/2604.24426v1-dymapia-a-multi-domain-framework-for-detecting-ai-based-video-manipulation)（8.0/10）
   摘要：本文提出DYMAPIA，一种面向AI生成视频篡改的多域检测框架，通过融合频域、空间纹理和时间一致性信息生成动态异常掩码，并用轻量级DistXCNet分类器进行像素级识别。在FF\+\+、Celeb\-DF和VDFD数据集上准确率和F1均超过99%，同时模型紧凑支持实时部署。该方法在提高检测精度和可解释性的同时具备实际应用潜力，值得进一步精读。
6. [面向安全警报的自主调查方法](/202605/03/2604.25846v1-towards-agentic-investigation-of-security-alerts)（8.0/10）
   摘要：本论文针对安全运营中心中警报过载问题，提出一种基于大语言模型\(LLM\)的代理式调查工作流，通过结构化查询和工具访问自动化早期警报分析。实验表明，该方法在从日志中提取证据和生成警报判定方面准确率显著高于直接使用LLM，减轻了人工分析负担，值得关注其方法设计与实验结果。

## 速读区
1. [AsmRAG：通过检索功能相似的汇编代码进行基于大型语言模型的恶意软件检测](/202605/03/2604.23196v1-asmrag-llm-driven-malware-detection-by-retrieving-functionally-similar-assembly-code)（7.8/10）
   摘要：本文提出 AsmRAG，一种基于大语言模型的汇编代码检索增强生成框架，用于恶意软件检测与家族归属分析。通过将函数级汇编代码映射为语义向量，并采用密度加权锚点选择提取关键恶意逻辑，实现对混淆与变异代码的鲁棒检测。实验显示在 40k 二进制样本上检测 F1 96%、归属 F1 95%，提供可解释的证据输出，值得安全研究人员深入阅读。
2. [MARD：一种用于稳健安卓恶意软件检测的多智能体框架](/202605/03/2604.25264v1-mard-a-multi-agent-framework-for-robust-android-malware-detection)（7.8/10）
   摘要：本研究提出了一种多代理框架MARD，用于提升Android恶意软件检测的鲁棒性，解决了传统检测方法面临的概念漂移、特征浅层化和缺乏可解释性的问题。该方法通过结合大型语言模型（LLM）与传统静态分析引擎，利用自主多代理交互机制，提供更高效、更具语义推理能力的检测流程。MARD在多个数据集上的F1得分为93.46%，在五年的跨领域评估中表现出强大的鲁棒性和概念漂移适应能力，成本低至0.10美元/次深度分析。值得精读以深入了解其创新的多代理交互机制与高效性。
3. [Faithfulness\-QA：用于训练上下文忠实 RAG 模型的反事实实体替换数据集](/202605/03/2604.25313v2-faithfulness-qa-a-counterfactual-entity-substitution-dataset-for-training-context-faithful-rag-models)（7.8/10）
   摘要：本论文提出 Faithfulness\-QA 数据集，旨在提升 RAG 模型的上下文忠实性，通过对 SQuAD 和 TriviaQA 样本中的实体进行类型一致的反事实替换，制造上下文与模型参数知识的冲突，从而训练模型优先依赖检索内容。实验显示该方法可生成 99,094 个高质量样本，支持训练和评估上下文忠实性。该工作对研究 RAG 模型的上下文依赖性具有较高参考价值。
4. [SecGoal：一个用于从协议文档中提取和形式化安全目标的基准测试](/202605/03/2604.27601v1-secgoal-a-benchmark-for-security-goal-extraction-and-formalization-from-protocol-documents)（7.8/10）
   摘要：本论文提出了SecGoal数据集和AIFG框架，旨在自动从自然语言协议文档中提取和形式化安全目标。通过对比多种大语言模型，研究发现通用模型召回高但精确率低，而在SecGoal上进行指令微调的小型模型可显著提升F1值至80%以上。研究为协议自动形式化分析提供了首个可复现基准和方法参考，值得对自动化安全分析感兴趣的读者继续精读。
5. [CAN\-QA：面向车载CAN通信流推理的问答基准](/202605/03/2604.24935v1-can-qa-a-question-answering-benchmark-for-reasoning-over-in-vehicle-can-traffic)（7.6/10）
   摘要：本文提出 CAN\-QA，这是首个将车载 CAN 网络流量分析重构为问答任务的基准数据集，旨在提升入侵检测的可解释性和推理能力。通过将原始 CAN 日志切分为时间窗口并生成自然语言问题\-答案对，作者评估了大语言模型在时间序列推理和多条件推理上的表现。实验显示模型在表面统计模式上表现良好，但在复杂时序和行为理解上仍存在不足，提示该研究值得关注以探索更强的可解释安全分析方法。
6. [时间序列聚类在流量矩阵预测中的作用](/202605/03/2604.26081v1-on-the-role-of-time-series-clustering-in-traffic-matrix-prediction)（7.6/10）
   摘要：This paper explores the role of time\-series clustering in predicting traffic matrices \(TMs\), a key component in network traffic management. The authors propose a framework that divides traffic flows into smaller groups based on clustering methods, allowing for improved prediction accuracy compared to global forecasting models. Through experiments on real datasets, they show that clustering\-based prediction consistently outperforms global models, offering a balance between predictive performance and computational efficiency. The paper is worth reading if you're interested in improving TM prediction via clustering techniques and assessing the impact of different clustering methods on accuracy。
7. [大规模语言模型调试的系统化方法](/202605/03/2604.23027v1-a-systematic-approach-for-large-language-models-debugging)（6.9/10）
   摘要：本文提出了一种系统化的调试方法，用于解决大型语言模型（LLMs）在多任务、多场景下输出不可预测或错误的问题。通过将模型视为可观测系统，结合问题检测、证据收集、行为分析和迭代优化四阶段流程，研究展示了在多类型任务和代理化工作流中提升模型可解释性和性能的可行性。结果显示，该方法有效降低了模型幻觉率和重复操作，值得进一步精读以理解具体实践框架。
8. [大语言模型作为能源工业控制系统可解释的网络攻击检测器](/202605/03/2604.26079v1-large-language-models-as-explainable-cyberattack-detectors-for-energy-industrial-control-systems)（6.9/10）
   摘要：本文探索使用现成的大语言模型\(LLM\)作为能源工业控制系统\(ICS\)Modbus流量的可审计入侵检测辅助层，通过将每条通信转换为离散协议令牌并生成正常/关键警报及简明事件记录，实现高精度且无需任务特定训练。实验显示，该LLM在两个公开Modbus数据集上表现接近监督学习基线，同时提供操作员可审计的记录，适合快速判断是否值得深入研究。
9. [异构分组专家混合模型用于语言建模](/202605/03/2604.23108v1-mixture-of-heterogeneous-grouped-experts-for-language-modeling)（6.8/10）
   摘要：本文提出了Mixture of Heterogeneous Grouped Experts \(MoHGE\)架构，旨在提升大型语言模型在推理效率和GPU负载均衡方面的性能。通过两级路由机制、组内辅助损失和全尺寸组解耦分配策略，实现了任务难度适配的专家选择与均衡计算分配。实验显示MoHGE在保持或略超传统MoE性能的同时减少约20%参数，GPU利用率更均衡，值得在工业应用或高效推理研究中深入阅读。
10. [弥合姿态\-语义鸿沟：面向文本的人体异常搜索级联框架](/202605/03/2604.23282v1-bridging-the-pose-semantic-gap-a-cascade-framework-for-text-based-person-anomaly-search)（6.8/10）
   摘要：This paper addresses the problem of text\-based person anomaly search in surveillance systems. It proposes a novel Structure\-Semantic Decoupled Cascade \(SSDC\) framework, which separates structural filtering and semantic verification into two stages. The SSDC framework combines lightweight structural retrieval with a multi\-agent semantic verification process, effectively bridging the Pose\-Semantic Gap that traditional models struggle with. Experiments on the PAB benchmark show that SSDC achieves state\-of\-the\-art performance by balancing efficiency and semantic accuracy. This paper is highly relevant for those interested in improving anomaly detection in surveillance systems, and worth further exploration for its novel approach and solid experimental validation。
11. [基于机器学习的零信任物联网环境下高级异常检测与威胁情报](/202605/03/2604.23332v1-advanced-anomaly-detection-and-threat-intelligence-in-zero-trust-iot-environments-using-machine-learning)（6.8/10）
   摘要：本研究针对零信任 IoT 环境中复杂网络威胁，探索利用机器学习方法提升异常检测和威胁情报能力。通过 SVM、随机森林和决策树模型结合 SMOTE 技术处理数据不平衡，提升检测精度，并探索边缘计算和区块链辅助的威胁识别。结果显示这些方法显著改善了异常检测效果，并对高级持续性威胁和恶意 URL 检测具有潜力，值得在 IoT 安全和零信任架构研究中深入阅读。

---
使用键盘方向键可在日报/论文之间快速切换。
