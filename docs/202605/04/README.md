# 日报 · 2026-05-04

- 生成时间：2026-05-04 20:23:22 UTC
- 当次推荐总数：13
- 精读区：2
- 速读区：11

## 今日简报（AI）
5月4日共浏览13篇安全与工业控制系统相关论文，完成2篇精读与11篇速读。  
重点关注：大语言模型在安全运营自动化与能源工业控制系统攻击检测中的应用最具前沿价值。  
建议普通读者可关注AI在网络安全自动化和跨工厂异常检测的潜力，了解技术趋势。

## 精读区
1. [迈向自主化 SOC 运维：用于威胁检测、查询生成与安全运维解决的端到端大语言模型框架](/202605/04/2604.27321v1-toward-autonomous-soc-operations-end-to-end-llm-framework-for-threat-detection-query-generation-and-resolution-in-security-operations)（8.3/10）
   摘要：本文提出一个面向安全运营中心（SOC）的端到端自动化框架，结合多模型集成的威胁检测、语法约束的查询生成（SQM）、以及基于证据的事件解决与建议生成。实验证明该框架在SIEM日志上实现82.8%检测准确率、查询生成性能提升两倍以上，并将事件处理时间从数小时缩短至10分钟以内，显示出显著效率提升和可操作性，值得继续精读。
2. [将大型语言模型作为能源工业控制系统的可解释网络攻击检测器](/202605/04/2604.26079v1-large-language-models-as-explainable-cyberattack-detectors-for-energy-industrial-control-systems)（8.0/10）
   摘要：本文研究了将现成大型语言模型（LLM）作为能源工业控制系统（ICS）Modbus流量的可解释入侵检测辅助工具，采用将Modbus通信离散化为令牌并通过提示配置LLM进行二分类（正常/关键）的方法。实验在两个公开数据集上显示，该方法在无需任务特定训练的情况下，与监督学习基线性能相当，同时提供可审计的事件记录，适合人机协作的安全监控场景，值得对方法设计和实验评估部分深入精读。

## 速读区
1. [基于中点原型对齐的跨工厂未知攻击检测在工业控制系统中的应用](/202605/04/2604.25544v1-medoid-prototype-alignment-for-cross-plant-unknown-attack-detection-in-industrial-control-systems)（7.8/10）
   摘要：本文针对工业控制系统跨工厂未知攻击检测提出了一种中值原型对齐方法，通过将异构流量映射到共享表示空间并提取稳健的中值原型，实现源域到目标域的结构化迁移。实验表明，该方法在天然气和水储存控制系统的四个未知攻击迁移任务中平均准确率达0.843，F1\-score达0.838，显示了良好的跨域鲁棒性，值得继续精读。
2. [SecMate：基于三重上下文个性化的多智能体自适应网络安全故障排查](/202605/04/2604.26394v1-secmate-multi-agent-adaptive-cybersecurity-troubleshooting-with-tri-context-personalization)（7.8/10）
   摘要：本研究提出SecMate，一种多智能体虚拟客服系统，用于网络安全故障排查，融合设备级、用户级和服务级个性化信息。通过设备诊断工具、用户隐式能力分析以及上下文感知推荐，SecMate在144名参与者的711次对话实验中将故障解决率从约50%提升至90%以上，同时降低用户负担，提高满意度。对于关注自适应VCAs在企业级安全支持中的实用性和经济性，值得精读。
3. [ShredBench：评估多模态大语言模型在文档重构中的语义推理能力](/202605/04/2604.23813v1-shredbench-evaluating-the-semantic-reasoning-capabilities-of-multimodal-llms-in-document-reconstruction)（7.8/10）
   摘要：本文提出 ShredBench，用于评估多模态大语言模型（MLLMs）在文档碎片重构中的语义推理能力。通过自动生成不同语言、代码和表格的碎片化文档，并设置多种碎片粒度进行测试，发现现有模型在完整文档上表现良好，但在碎片化场景下性能显著下降。研究揭示当前 MLLMs 缺乏跨模态精细推理能力，对视觉中断的处理有限，值得进一步精读以理解文档重构挑战与评价方法。
4. [Trident：结合大型语言模型与行为特征提升恶意软件检测](/202605/04/2605.00297v1-trident-improving-malware-detection-with-llms-and-behavioral-features)（7.6/10）
   摘要：本论文提出了 Trident 系统，通过结合静态特征的传统机器学习、行为特征规则以及大语言模型（LLM）分析沙箱报告，提升 PE 恶意软件检测能力。方法利用 LLM 自动生成行为检测规则，有效缓解概念漂移问题，同时保持低误报率。实验显示 Trident 在准确率、召回率及鲁棒性上均优于单独使用静态特征或行为规则的方法，值得进一步精读以理解 LLM 在安全检测中的应用。
5. [CyberCane：用于隐私保护的网络钓鱼检测的神经符号检索增强生成与形式本体推理](/202605/04/2604.23563v1-cybercane-neuro-symbolic-rag-for-privacy-preserving-phishing-detection-with-formal-ontology-reasoning)（7.5/10）
   摘要：本论文提出 CyberCane，一种面向隐私保护场景的网络\-符号混合钓鱼检测框架，通过双阶段流水线结合符号规则和隐私保护的检索增强生成\(RAG\)，并引入 PhishOnt 本体实现可验证攻击分类。实验显示在 DataPhish 2025 和 Nazario/SpamAssassin 数据集上，对 AI 生成威胁召回提升 78.6 点，精确度超过 98%，误报率低至 0.16%，在医疗场景部署 ROI 高达 542×。值得继续精读以评估实际部署可行性和多层可解释性机制。
6. [SMSI：系统模型安全推理——面向网络物理系统的自动化威胁建模](/202605/04/2604.23905v1-smsi-system-model-security-inference-automated-threat-modeling-for-cyber-physical-systems)（7.5/10）
   摘要：本论文提出 SMSI（System Model Security Inference），旨在自动化针对网络物理系统的威胁建模，从 SysML 架构模型出发，生成可追踪到具体组件、漏洞和攻击手法的 NIST 800\-53 控制推荐。方法结合确定性解析器、检索与分类模型以及控制推荐器，实验在医疗物联网网关上验证效果显著，显著减少人工分析时间，值得精读系统设计与实验评估部分。
7. [AgentVisor：通过语义虚拟化防御大语言模型代理的提示注入攻击](/202605/04/2604.24118v1-agentvisor-defending-llm-agents-against-prompt-injection-via-semantic-virtualization)（6.9/10）
   摘要：本论文提出 AgentVisor，一种基于语义虚拟化的防御框架，用于保护 LLM 代理免受直接和间接提示注入攻击。通过将代理作为不可信客体，利用受信的语义监控器拦截工具调用，并设计 STI 审计协议与一次性自我修复机制，实验显示攻击成功率降至 0.65%，平均效用仅下降 1.45%，显示出在安全与实用性上的优越性，值得精读安全机制与实验分析。
8. [Pythia：迈向可预测性驱动的原生多智能体大语言模型服务](/202605/04/2604.25899v1-pythia-toward-predictability-driven-agent-native-llm-serving)（6.9/10）
   摘要：本文提出 Pythia，一种面向多代理工作流的 LLM 服务系统，利用工作流可预测性优化资源调度与缓存策略，从而提升吞吐量和作业完成时间。通过对生产环境多代理编码助手和深度研究系统的分析，发现传统黑箱服务存在缓存命中率低、资源争用严重和队列延迟大等问题。Pythia 的实验结果显示显著改善性能，值得关注多代理 LLM 的高效部署策略。
9. [NODE：数据平面中的全网 Top\-K 流量检测](/202605/04/2604.23778v1-node-network-wide-top-k-flows-in-the-data-plane)（6.8/10）
   摘要：本文提出 NODE，一种完全在数据平面运行的网络全局 Top\-K 流量检测算法，旨在解决传统集中式控制器方法延迟高、难以捕获短时突发流量的问题。通过在每个交换机维护本地 Top\-K 表，并利用 Swish 框架共享和聚合信息，NODE 可在网络中实现全局一致的 Top\-K 流量表。实验显示，NODE 在模拟和真实流量追踪下召回率超过 95%，每台交换机内存消耗低于 300KB，值得进一步精读以了解其分布式数据平面实现机制和性能优化策略。
10. [MARD：一种用于稳健安卓恶意软件检测的多智能体框架](/202605/04/2604.25264v1-mard-a-multi-agent-framework-for-robust-android-malware-detection)（6.8/10）
   摘要：从提供的信息来看，论文《MARD: A Multi\-Agent Framework for Robust Android Malware Detection》提出了一个多智能体框架用于提升安卓恶意软件检测的鲁棒性，但正文内容缺失，无法获取方法细节或实验结果。因此无法判断其实际效果或创新性，精读价值无法完全评估。
11. [结构化输出基准：用于评估大语言模型结构化输出质量的多源基准](/202605/04/2604.25359v1-the-structured-output-benchmark-a-multi-source-benchmark-for-evaluating-structured-output-quality-in-large-language-models)（6.8/10）
   摘要：本文提出了SOB（Structured Output Benchmark），用于评估大型语言模型在多源（文本、图像、音频）结构化输出任务中的表现。研究构建了统一JSON schema评估框架，并测量了模式合规性、值准确性等七个指标。实验发现，模型在模式合规性上接近完美，但在值准确性上随来源复杂度下降明显（文本83%、图像67%、音频24%），显示生成正确结构化数据仍有挑战。该研究对多源结构化提取评估提供了完整数据集与代码，值得进一步精读。

---
使用键盘方向键可在日报/论文之间快速切换。
