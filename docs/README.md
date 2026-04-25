<div class="dpr-home-notice-card">
  <h3 class="dpr-home-notice-title">🚀 Start Here</h3>
  <ul class="dpr-home-notice-list">
    <li><a href="#/tutorial/README">使用教程</a></li>
  </ul>
</div>

## 每次日报
- 最新运行日期：2026-04-24
- 运行时间：2026-04-24 20:28:17 UTC
- 运行状态：成功
- 本次总论文数：15
- 精读区：4
- 速读区：11

### 今日简报（AI）
今天完成了15篇论文的筛选与阅读，其中4篇精读、11篇速读，重点集中在安全与网络智能方向。  
最值得关注的是基于图自编码器的个体网络流量预测，以及面向内存破坏分析的检索增强漏洞挖掘方法，整体偏向“预测建模 \+ 安全分析”的融合趋势。  
建议后续优先跟进安全评测与网络流量建模相关工作，这两条线正在快速形成方法论收敛。
- 详情：[/202604/24/README](/202604/24/README)

### 精读区论文标签
1. [Forecasting Individual NetFlows using a Predictive Masked Graph Autoencoder](/202604/24/2604.20483v1-forecasting-individual-netflows-using-a-predictive-masked-graph-autoencoder)  
   标签：评分：8.5/10、query:q7
   摘要：本文提出一种预测式掩码图自编码器（Graph MAE）结合GNN，用于细粒度NetFlow逐流预测。通过滑动窗口构建包含IP/端口/连接节点的动态图，并与LSTM、TCN、Transformer、DLinear等基线对比。结果显示模型在连接结构（IP/Port归属识别）上显著更优，特征重建性能也具竞争力，证明GNN在流级预测中的潜力，适合作为探索性但仍需更大规模验证。
   evidence：使用图神经网络预测网络流量
2. [RAVEN: Retrieval\-Augmented Vulnerability Exploration Network for Memory Corruption Analysis in User Code and Binary Programs](/202604/24/2604.17948v1-raven-retrieval-augmented-vulnerability-exploration-network-for-memory-corruption-analysis-in-user-code-and-binary-programs)  
   标签：评分：8.4/10、query:q9
   摘要：本研究提出了RAVEN框架，利用大型语言模型和检索增强生成（RAG）技术，自动化生成专业级漏洞分析报告。该框架通过四个模块（Explorer、RAG引擎、Analyst和Reporter）对漏洞进行深入探索和分析，并通过LLM Judge评估报告质量。实验结果表明，RAVEN在105个漏洞代码样本上的平均质量得分为54.21%，显示了其在漏洞报告自动化方面的潜力，值得深入阅读。
   evidence：基于LLM的漏洞分析与安全报告生成
3. [Cyber Defense Benchmark: Agentic Threat Hunting Evaluation for LLMs in SecOps](/202604/24/2604.19533v1-cyber-defense-benchmark-agentic-threat-hunting-evaluation-for-llms-in-secops)  
   标签：评分：8.1/10、query:q9
   摘要：本研究提出了网络防御基准，评估大型语言模型（LLM）在无指导的威胁狩猎任务中的能力。通过对106个真实攻击程序的测试，发现当前主流模型在识别恶意事件时间戳方面表现不佳，最佳模型仅正确标记了3.8%的恶意事件。这表明现有LLM在开放式、证据驱动的威胁狩猎中能力不足，值得进一步研究和改进。
   evidence：提出了一个用于安全操作的LLM基准，与网络流量分析密切相关
4. [Cyber Defense Benchmark: Agentic Threat Hunting Evaluation for LLMs in SecOps](/202604/24/2604.19533v2-cyber-defense-benchmark-agentic-threat-hunting-evaluation-for-llms-in-secops)  
   标签：评分：8.0/10、query:q9
   摘要：本文提出Cyber Defense Benchmark，用真实Windows攻击日志构建无引导的开放式威胁狩猎评测环境，要求LLM代理通过迭代SQL查询在7.5万\-13.5万条日志中定位恶意事件时间戳。覆盖106个攻击流程与93个MITRE ATT&CK子技术。实验显示最强模型覆盖率仅0.55且均无法达到战术级最低要求，表明当前LLM难以胜任真实SOC级别的开放式威胁狩猎任务，具有较强研究价值但需结合局限谨慎精读。
   evidence：评估了LLM在安全运营中的应用

### 速读区论文标签
1. [Cyber Defense Benchmark: Agentic Threat Hunting Evaluation for LLMs in SecOps](/202604/24/2604.19533v3-cyber-defense-benchmark-agentic-threat-hunting-evaluation-for-llms-in-secops)  
   标签：评分：7.9/10、query:q9
   摘要：This paper introduces the Cyber Defense Benchmark, a new evaluation framework for assessing large language models \(LLMs\) in performing agentic threat hunting on raw Windows event logs. The benchmark involves identifying malicious events without guided questions, simulating real attack procedures with diverse MITRE ATT&CK techniques. Despite strong performances on Q&A\-based security tasks, current LLMs underperform significantly in open\-ended threat hunting, with no model passing a minimal operational bar. The study indicates that LLMs are not yet suitable for raw telemetry\-based threat hunting tasks, highlighting challenges for their deployment in real\-world security operations。
   evidence：聚焦LLMs在网络安全中的应用，特别是威胁猎杀工具的实践
2. [SecureRouter: Encrypted Routing for Efficient Secure Inference](/202604/24/2604.15499v1-securerouter-encrypted-routing-for-efficient-secure-inference)  
   标签：评分：7.8/10、query:q7
   摘要：论文提出SecureRouter用于安全多方计算\(MPC\)下的加密Transformer推理加速，针对传统仅使用单一固定模型导致的高延迟问题，引入在密文特征上进行输入自适应模型路由的安全路由器，并联合优化MPC成本感知的模型池与量化结构，在不泄露输入与路由决策的前提下减少通信与非线性计算开销，实现约1.95倍延迟降低且几乎无精度损失，整体在隐私计算推理场景中具有较高实用价值，值得进一步精读其路由建模与成本设计部分。
   evidence：用于高效变换器推理的加密路由
3. [DEMUX: Boundary\-Aware Multi\-Scale Traffic Demixing for Multi\-Tab Website Fingerprinting](/202604/24/2604.15677v1-demux-boundary-aware-multi-scale-traffic-demixing-for-multi-tab-website-fingerprinting)  
   标签：评分：7.8/10、query:q4
   摘要：这篇论文提出了DEMUX，一个面向多标签网站指纹识别的边界感知多尺度流量解混框架。现有方法在多标签场景下表现不佳，DEMUX通过重叠窗口分割、多尺度并行CNN和旋转位置编码等技术，显著提升了解混效果。实验结果表明，DEMUX在多个复杂场景下表现优异，特别是在5标签闭世界设置下，性能超越了现有基准方法9.2%。如果关注深度学习在流量分析中的应用，尤其是多标签场景中的挑战，该文值得进一步阅读。
   evidence：深度学习加密流量网站指纹识别
4. [FedLLM: A Privacy\-Preserving Federated Large Language Model for Explainable Traffic Flow Prediction](/202604/24/2604.16612v1-fedllm-a-privacy-preserving-federated-large-language-model-for-explainable-traffic-flow-prediction)  
   标签：评分：7.8/10、query:q9
   摘要：本文提出FedLLM，将联邦学习与领域适配的大语言模型结合用于15–60分钟短时交通流预测，在不共享原始数据前提下提升隐私保护与跨区域泛化能力，并增强预测结果的可解释性。方法通过CSS进行路段选择、结构化交通prompt编码时空信息，并在联邦框架中以LoRA参数高效聚合，实现非IID场景下的协同训练。实验结果显示其在多基线对比中取得更优预测性能，同时输出更具结构化解释的结果，整体具有较强实用潜力，值得进一步精读。
   evidence：提出了一种联邦LLM用于流量预测，与网络分析和LLM密切相关。
5. [Systematic Capability Benchmarking of Frontier Large Language Models for Offensive Cyber Tasks](/202604/24/2604.17159v1-systematic-capability-benchmarking-of-frontier-large-language-models-for-offensive-cyber-tasks)  
   标签：评分：7.8/10、query:q9
   摘要：本文系统评估前沿大模型在进攻性网络安全任务中的能力，基于NYU CTF Bench 200道题对10个模型进行对比，并扩展D\-CIPHER多智能体框架与Kali Linux工具环境做因子实验。结果显示环境与工具链是关键变量：Kali环境提升约9.5个百分点，Claude 4.5 Opus以59%通过率领先，Gemini 3 Pro为52%，而提示工程在强工具环境中反而常降效，整体显示能力差异更受系统工程影响而非单纯模型能力。
   evidence：针对进攻性网络安全任务的LLM基准测试，与网络流量分析相关
6. [ExAI5G: A Logic\-Based Explainable AI Framework for Intrusion Detection in 5G Networks](/202604/24/2604.18052v1-exai5g-a-logic-based-explainable-ai-framework-for-intrusion-detection-in-5g-networks)  
   标签：评分：7.8/10、query:q3
   摘要：本研究提出ExAI5G，一个结合Transformer深度学习与逻辑基础可解释AI的方法，用于提升5G网络入侵检测系统的透明性和信任度。在5G IoT数据集上，该系统展示了99.9%的准确率和高达99.7%保真度的逻辑规则提取能力。这表明可以在不牺牲性能的情况下实现有效且可信赖的IDS，因此值得进一步细读。
   evidence：探讨LLM在5G入侵检测中的应用，关联到网络流量分析和LLM应用
7. [Beyond Nodes vs. Edges: A Multi\-View Fusion Framework for Provenance\-Based Intrusion Detection](/202604/24/2604.14685v1-beyond-nodes-vs-edges-a-multi-view-fusion-framework-for-provenance-based-intrusion-detection)  
   标签：评分：6.8/10、query:q5
   摘要：本文针对基于系统溯源图的入侵检测中节点视角与边视角各自偏置导致误报与漏报的问题，提出PROV\-FUSION多视图融合框架，将属性、结构与因果三类异常信号统一建模，并通过轻量融合与投票机制进行决策。在DARPA多个基准数据集上，相比单一节点/边方法显著提升检测准确率并降低误报率，表现稳定，适合关注图学习安全检测的读者深入阅读。
   evidence：基于来源的入侵检测与机器学习
8. [Co\-Design of Cryptographic Parameters and Delay\-Aware Feedback Gain for Encrypted Control Systems](/202604/24/2604.14774v1-co-design-of-cryptographic-parameters-and-delay-aware-feedback-gain-for-encrypted-control-systems)  
   标签：评分：6.8/10、query:q4
   摘要：本文针对同态加密控制系统中加密带来的通信与计算延迟会随安全等级提升而恶化的问题，提出加密参数与控制器的协同设计框架。方法上将延迟显式建模为加密参数函数，并在给定参数下推导出基于线性矩阵不等式（LMI）的稳定性充分条件，从而构建外层搜索加密参数、内层设计延迟感知反馈增益的优化流程。整体以理论可行性为主，提供了安全性与控制性能之间权衡的系统化设计路径，具有一定精读价值但需关注其保守性与适用范围。
   evidence：同态加密用于安全控制系统
9. [Characterization of Real Communication Patterns and Congestion Dynamics in HPC Interconnection Networks](/202604/24/2604.16088v1-characterization-of-real-communication-patterns-and-congestion-dynamics-in-hpc-interconnection-networks)  
   标签：评分：6.8/10、query:q7
   摘要：本研究提出了一种基于VEF Traces框架的方法，旨在表征和模拟高性能计算中的通信模式及其引发的网络拥塞。通过对多个超级计算机上运行的代表性应用程序（如NEST、GROMACS等）的分析，识别出潜在的拥塞场景，并扩展了现有框架以支持更全面的流量建模。这项研究为理解和优化HPC网络设计提供了重要见解，值得深入阅读。
   evidence：高性能计算网络通信模式与拥塞动态分析
10. [Enhancing Anomaly\-Based Intrusion Detection Systems with Process Mining](/202604/24/2604.18066v1-enhancing-anomaly-based-intrusion-detection-systems-with-process-mining)  
   标签：评分：6.8/10、query:q5
   摘要：本文提出将流程挖掘引入基于异常的入侵检测系统，用于对网络包级序列建模，从而对告警进行严重度评分与可解释分析。方法在训练阶段构建正常与误报流量的流程模型，推理阶段通过流程相似度评估告警严重度，实现真阳性与误报区分。在USB\-IDS\-TC与Slowloris数据集上，在保持99.94%召回与99.99%精度的同时有效过滤误报并提供分级解释，体现出较强的实用价值与模型无关性，值得进一步精读方法细节。
   evidence：深度学习用于异常加密流量检测
11. [Dual\-View Training for Instruction\-Following Information Retrieval](/202604/24/2604.18845v1-dual-view-training-for-instruction-following-information-retrieval)  
   标签：评分：6.8/10、query:q1
   摘要：提出面向指令跟随信息检索的双视角训练方法，通过LLM生成“极性反转”指令，使同一文档对在不同指令下正负标签互换，从而强化检索器对指令约束的敏感性。在FollowIR上305M编码器提升约45%，优于同规模甚至更大模型，并分析数据多样性与指令监督的权衡。方法简单有效，值得深入阅读。
   evidence：针对查询v的指令跟随检索


<div class="dpr-home-promo-card">
  <h3 class="dpr-home-promo-title">💬 社区与支持</h3>
  <ul class="dpr-home-promo-list">
    <li>欢迎 Star / Fork / Issue / PR</li>
    <li>QQ群：583867967（欢迎交流，已有：1151人）</li>
  </ul>
</div>

<!--dpr-seed-papers:start-->
## Seed Papers
- [Latest: Wan et al.   2025   CATO End to end optimization of ML based traffic analysis pipelines](/seed-papers/1777113876678/index)
<!--dpr-seed-papers:end-->
