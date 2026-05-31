# 日报 · 2026-05-31

- 生成时间：2026-05-31 20:18:06 UTC
- 当次推荐总数：14
- 精读区：3
- 速读区：11

## 今日简报（AI）
1. 今日共筛选阅读 14 篇安全与 AI 相关论文，重点关注大模型驱动的网络攻防、防御自动化与隐私计算。  
2. 最值得关注的是利用 RAG\+大模型提升 SDN 环境下 DDoS 攻击检测与缓解，以及通过大模型实现自动化渗透测试（APT\-Agent）两大方向。  
3. 建议优先跟进“大模型\+网络安全”实践落地，同时关注同态加密训练、IoT 入侵检测等兼顾安全性与可部署性的技术进展。

## 精读区
1. [基于检索增强生成与大语言模型的 SDN 中地毯式轰炸 DDoS 攻击智能检测与缓解](/202605/31/2605.26307v1-intelligent-detection-and-mitigation-of-carpet-bombing-ddos-attacks-in-sdn-using-retrieval-augmented-generation-and-large-language-models)（8.3/10）
   摘要：本文针对软件定义网络\(SDN\)中复杂的Carpet\-Bombing DDoS攻击，提出了基于RAG和大语言模型\(LLM\)的实时检测与缓解框架。方法结合接口流量特征表示、语义嵌入、FAISS检索和LLM上下文推理，无需传统监督训练。实验表明该框架在多种攻击强度下实现了高精度稳定检测，并能快速减轻攻击影响，保持网络运行稳定，值得继续精读方法设计与实验部分。
2. [APT\-Agent：利用大语言模型实现自动化渗透测试](/202605/31/2605.24949v1-apt-agent-automated-penetration-testing-using-large-language-models)（8.2/10）
   摘要：论文提出APT\-Agent，一个基于大语言模型的全自动渗透测试框架，目标是解决现有LLM渗透系统中的技术实体幻觉和长程上下文记忆不足问题。核心方法包括用于纠正错误Metasploit模块与命令的混合校正模块，以及面向攻击阶段的命令记忆架构。作者在Metasploitable 2上评测七类漏洞服务，端到端利用成功率达到84.29%，显著高于PentestGPT等基线。若关注LLM Agent在攻防自动化中的可靠性与执行能力，值得继续细读。
3. [迈向网络安全超级智能（CSI）：什么是网络安全领域的最佳智能体执行框架？](/202605/31/2605.28334v1-towards-cybersecurity-superintelligence-csi-whats-the-best-harness-for-cybersecurity)（8.0/10）
   摘要：论文试图回答“网络安全AI最优执行框架（scaffold/harness）是什么”。作者提出Cybersecurity SuperIntelligence（CSI）元框架，将Claude、Codex、CAI、GCAI、Mistral等异构Agent脚手架统一到同一编排层，在相同模型\(alias2\-mini\)和33个cybench挑战上进行对照实验。结果显示单一脚手架并非最优，不同脚手架具有互补性；基于黑板（blackboard）的多Agent协作可将成功率从45.5%提升到57.6%。若关注Agent系统设计、网络安全Agent和多智能体协同，值得继续精读。

## 速读区
1. [保障高性能数据传输安全：在 RDMA 系统中实现 AES 加密](/202605/31/2605.25026v1-securing-high-performance-data-transfers-implementing-aes-encryption-in-rdma-systems)（7.8/10）
   摘要：本文针对RDMA系统在高性能数据传输中缺乏内置安全机制的问题，提出将AES\-128加密直接集成到可编程Tofino交换机的数据平面中，实现低延迟、高吞吐量的安全数据传输。作者通过P4语言实现加密管道，实验显示16~128字节包的吞吐量可达0.37~1.9 Gbps，且几乎无丢包。该方法兼顾性能与安全性，对于追求高性能又需数据保密的场景值得进一步精读。
2. [重新审视全同态加密下的机器学习训练：收敛性保证、差分隐私与高效算法](/202605/31/2605.27782v1-revisiting-ml-training-under-fully-homomorphic-encryption-convergence-guarantees-differential-privacy-and-efficient-algorithms)（7.8/10）
   摘要：论文尝试系统解决“如何在全同态加密（FHE）环境下进行可证明收敛、可扩展且具差分隐私（DP）保障的机器学习训练”问题。作者给出了首个 FHE 训练的理论收敛分析，用多项式近似替代激活与损失函数，并提出无需 per\-sample clipping 的 DP\-GD 变体，通过 barrier 项控制参数范围，从而显著降低 FHE 下的乘法深度与计算成本。实验显示其精度接近传统 DP\-GD，但复杂度大幅下降。若关注隐私机器学习、加密训练或 DP\-FHE 结合，这篇很值得细读。
3. [通过平衡学习、可靠伪标签与轻量化架构增强面向物联网的自主在线入侵检测](/202605/31/2605.26166v1-enhancing-autonomous-online-intrusion-detection-for-iot-with-balanced-learning-reliable-pseudo-labels-and-lightweight-architectures)（7.5/10）
   摘要：本文针对物联网\(IoT\)入侵检测系统\(IDS\)面临的类不平衡、伪标签不可靠、泛化能力不足及计算资源受限等问题，提出了一套改进方案。通过结合XGBoost平衡采样、伪标签过滤、Mixup数据增强和轻量级自编码器\(LiteAE\)架构，实现了在UNSW\-NB15数据集上的性能提升，准确率最高达95.45%，模型参数减少55%，兼顾精度与部署可行性。研究显示这些改进方法有效提升了AOC\-IDS的实用性，值得进一步精读其方法和实验设计。
4. [网络安全 AI（CAI）数据集](/202605/31/2605.28146v1-cybersecurity-ai-cai-dataset)（7.5/10）
   摘要：本论文介绍了CAI Dataset，一个收集自14个月、涵盖全球16,768个源IP和23,147个目标域的网络安全LLM操作轨迹数据集，规模达18.07TB。数据涵盖进攻、防御及业务场景，强调真实操作员的行为轨迹，而非模型能力。研究显示，基于这些操作轨迹训练的专用LLM能提升网络安全任务表现。若关注网络安全AI模型训练与操作数据，这篇论文值得精读。
5. [用于鲁棒网络入侵检测的元量子集成框架](/202605/31/2605.28879v1-meta-quantum-ensemble-framework-for-robust-network-intrusion-detection)（7.3/10）
   摘要：论文关注量子机器学习在入侵检测系统中的稳定性与低误报问题，探索不同量子模型能否通过集成获得互补收益。作者提出MQE（Meta\-Quantum Ensemble）框架，将QSVM与QNN的输出交由Random Forest元学习器融合，利用两类量子模型的一致与分歧信息进行决策。在TON IoT和CICIDS2017数据集上，MQE相较多个单独量子模型提升了检测性能、低FPR表现和可靠性指标。若关注量子AI在网络安全中的实际价值与集成策略，值得进一步阅读。
6. [CALIBURN：面向运行校准流式入侵检测的机制敏感性研究](/202605/31/2605.24696v1-caliburn-a-regime-sensitivity-study-of-operationally-calibrated-streaming-intrusion-detection)（7.2/10）
   摘要：本文研究流式网络入侵检测中“如何在部署前直接依据业务成本和告警预算设定告警策略”的问题，提出由BOCPD、等距回归校准、成本敏感阈值、CRC风险控制和SRE式burn\-rate告警组成的CALIBURN管线。作者重点不是证明方法普适有效，而是分析其在不同攻击占比场景下的适用边界。结果显示其在低攻击率场景显著优于现有流式方法，但在高攻击率场景接近理论下限并出现CRC退化。若关注可运维、可校准的流式安全告警系统，值得细读。
7. [超越查询记忆：基于查询分解与历史匹配的大语言模型路由方法](/202605/31/2605.25558v1-beyond-query-memorization-large-language-model-routing-with-query-decomposition-and-historical-matching)（6.9/10）
   摘要：论文关注LLM路由器在分配查询到不同模型时过度依赖表层语义、导致OOD泛化差的问题。作者提出DecoR，将路由从“查询→模型”的直接映射改为“查询能力需求→历史日志匹配→模型选择”。核心通过将查询拆解为技能、知识和难度维度，在历史日志中寻找能力相似案例，并依据历史表现进行决策。实验基于新构建的CodaSet评测，结果表明其在ID与OOD场景下均能保持较高准确率并降低成本。若关注LLM系统优化与路由泛化，值得继续细读。
8. [毒化瞭望塔：通过对抗性日志内容针对 LLM 增强型安全运营的提示注入攻击](/202605/31/2605.24421v1-poisoning-the-watchtower-prompt-injection-attacks-against-llm-augmented-security-operations-through-adversarial-log-content)（6.8/10）
   摘要：本文研究了LLM在安全运营中心处理日志时的结构性风险，即攻击者可控制日志字段并通过其中注入指令影响模型输出。作者提出了四类日志注入攻击（直接覆盖、身份劫持、上下文操控、混淆载荷），在gpt\-4o\-mini上进行48种策略\-防御\-任务组合实验，发现直接覆盖效果有限，而身份劫持和上下文操控对分类和摘要任务仍具高风险。研究表明，即使防御存在，残余攻击面依旧存在，强调将原始日志视为敌对输入的重要性。该研究值得关注安全LLM部署的潜在威胁和防御策略。
9. [用于视觉语音识别的扩散大语言模型](/202605/31/2605.28456v1-diffusion-large-language-models-for-visual-speech-recognition)（6.8/10）
   摘要：论文关注视觉语音识别中自回归解码过早决定模糊词的问题，提出首个基于扩散大语言模型的VSR框架DLLM\-VSR，将转录建模为迭代掩码去噪过程，通过置信度优先解码和双向上下文逐步消解视觉歧义。作者进一步设计两阶段训练策略和长度引导候选解码以缓解长度建模误差。在LRS3仅使用标注数据训练条件下达到19.5% WER并刷新SOTA，若关注非自回归/扩散式语音识别，值得细读。
10. [更少步骤，更优性能：基于语言的视频时刻检索中的高效跨模态片段裁剪](/202605/31/2605.29793v1-fewer-steps-better-performance-efficient-cross-modal-clip-trimming-for-video-moment-retrieval-using-language)（6.8/10）
   摘要：论文聚焦语言视频时刻检索（VMR）在超长视频上的效率与边界偏移问题，指出现有方法对整段视频固定采样后再做跨模态交互，既昂贵又容易遗漏关键帧。作者提出 SpotVMR，通过查询条件驱动的 clip search 与低成本语义索引，先快速定位潜在相关区域，再选择性执行跨模态推理，并引入蒸馏损失稳定联合训练。实验显示其在 Charades\-STA 等数据集上同时提升 QPS 与 R@1，具备较强工程价值，值得关注高效视频检索方向的读者继续精读。
11. [并非所有输入都有效：迈向基于语言的开放集视频时刻检索](/202605/31/2605.29812v1-not-all-inputs-are-valid-towards-open-set-video-moment-retrieval-using-language)（6.8/10）
   摘要：论文首次提出开放集视频时刻检索（OS\-VMR）任务，指出传统VMR默认所有文本查询都与视频相关，导致面对无关查询时仍会错误定位片段。作者设计OpenVMR，通过归一化流学习ID查询分布、利用不确定性分数区分ID/OOD查询，并结合粗细粒度跨模态匹配及正负未标注学习完成检索。实验表明该方法在三个VMR数据集上有效兼顾OOD拒识与ID时刻定位。若关注开放集多模态检索、安全可靠检索或OOD检测，值得继续细读。

---
使用键盘方向键可在日报/论文之间快速切换。
