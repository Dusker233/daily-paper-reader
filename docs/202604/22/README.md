# 日报 · 2026-04-22

- 生成时间：2026-04-22 20:09:01 UTC
- 当次推荐总数：16
- 精读区：5
- 速读区：11

## 今日简报（AI）
今天成功完成了16篇论文的精读与速读，其中精读5篇，速读11篇。  
值得关注的两篇精读文章涉及LLM在安全操作中的威胁狩猎与加密路由技术。  
建议继续深入研究LLM在网络安全中的应用，特别是在通信和隐私方面的优化。

## 精读区
1. [网络防御基准：大型语言模型在安全运营中的主动威胁狩猎评估](/202604/22/2604.19533v1-cyber-defense-benchmark-agentic-threat-hunting-evaluation-for-llms-in-secops)（8.5/10）
   摘要：本研究提出了网络防御基准，用于评估大型语言模型（LLM）在无指导情况下从原始Windows事件日志中识别恶意事件时间戳的能力。通过对五个前沿模型进行测试，发现它们在这一任务上表现极差，最佳模型仅标记了3.8%的恶意事件。这表明当前LLM不适合开放式、证据驱动的威胁狩猎，因此值得深入探讨其局限性和改进方向。
2. [SecureRouter：高效安全推理的加密路由](/202604/22/2604.15499v1-securerouter-encrypted-routing-for-efficient-secure-inference)（8.2/10）
   摘要：SecureRouter 提出了一个加密路由与推理的端到端框架，旨在通过输入自适应的模型选择提升安全推理的效率。其方法通过设计一个 MPC 感知的安全路由器和与之协同训练的模型池，有效减少了推理延迟，并在保证准确度的同时显著降低了计算成本。实验结果表明，SecureRouter 能在 GLUE 任务中实现最高 1.95 倍的延迟降低，且几乎不损失准确度，是实现可扩展、安全推理的一个实际路径。如果你对提高安全推理效率的技术感兴趣，值得继续精读。
3. [MLDAS：基于机器学习的动态算法选择用于软件定义网络安全](/202604/22/2604.14957v1-mldas-machine-learning-dynamic-algorithm-selection-for-software-defined-networking-security)（8.2/10）
   摘要：本文提出了一种基于机器学习动态算法选择的方案，旨在提升软件定义网络（SDN）中的网络安全性。通过分析不同网络流量特征，该方法可动态选择最合适的机器学习算法，优化入侵检测系统（IDS）的表现。实验结果表明，所提方案能有效提高DDoS攻击的检测准确率与网络性能。值得深入阅读，特别是关于实验结果与算法优化部分。
4. [DEMUX：面向边界的多尺度流量解混合方法用于多标签网站指纹识别](/202604/22/2604.15677v1-demux-boundary-aware-multi-scale-traffic-demixing-for-multi-tab-website-fingerprinting)（8.0/10）
   摘要：本论文提出了DEMUX框架，旨在解决多标签网站指纹识别中的流量解混问题。现有方法在用户多开标签时效果显著下降，DEMUX通过边界保留聚合模块、并行多尺度CNN以及带有旋转位置编码的Transformer结构，成功处理了多标签流量的边界信号、尺度多样性及时间关联问题。实验结果表明，DEMUX在多个场景中表现出色，特别是在复杂的5标签闭集环境下，P@5为0.943，MAP@5为0.961。值得继续精读。
5. [SafeLM：面向可信联邦大语言模型的统一隐私感知优化](/202604/22/2604.16606v1-safelm-unified-privacy-aware-optimization-for-trustworthy-federated-large-language-models)（8.0/10）
   摘要：本文提出 SafeLM，一种联合隐私、安全、去虚假信息和对抗鲁棒性的联邦大语言模型优化框架，通过梯度智能化、Paillier 同态加密、对比引导与校准解码以及二值聚合提升安全性和效率。实验显示其在有害内容检测、通信量压缩和梯度反演防护上表现优异，综合权衡隐私、效用与效率。对于需要在高风险场景部署 LLM 的读者，值得进一步精读。

## 速读区
1. [一石三鸟：通过零阶优化解决无线网络中LLM微调中的通信\-内存\-隐私三难困境](/202604/22/2604.12401v1-three-birds-one-stone-solving-the-communication-memory-privacy-trilemma-in-llm-fine-tuning-over-wireless-networks-with-zeroth-order-optimization)（7.8/10）
   摘要：本文提出了pAirZero框架，旨在解决大规模语言模型（LLM）在无线网络上进行联合学习时的通信、内存和隐私三重难题。通过结合零阶优化和无线空中计算，pAirZero不仅有效减少了通信负载和内存需求，还在传输过程中嵌入差分隐私机制。实验表明，pAirZero在通信和内存效率上优于传统方法，且在保证隐私的同时能提供与理想无隐私基准相当的性能。如果对LLM的边缘计算和隐私保护感兴趣，可以继续细读。
2. [TLoRA\+: 一种针对大规模语言模型的低秩参数高效微调方法](/202604/22/2604.13368v1-tlora-a-low-rank-parameter-efficient-fine-tuning-method-for-large-language-models)（7.8/10）
   摘要：本研究提出了TLoRA\+，一种低秩参数高效微调方法，旨在提升大语言模型（LLM）的微调效率和性能，尤其在有限计算资源下。TLoRA\+通过引入三矩阵分解优化器，相较于传统的LoRA方法，能够进一步提升性能且不显著增加计算成本。实验结果表明，该方法在多个基准测试上都能达到或超越全量微调的性能，适用于各种大规模语言模型的任务适配。值得继续细读以了解三矩阵分解的详细工作原理和性能对比。
3. [前沿大型语言模型在攻击性网络任务中的系统能力基准评测](/202604/22/2604.17159v1-systematic-capability-benchmarking-of-frontier-large-language-models-for-offensive-cyber-tasks)（7.8/10）
   摘要：This paper systematically evaluates the performance of 10 frontier large language models \(LLMs\) on offensive cybersecurity tasks using the NYU CTF Bench. The authors introduce a controlled factorial study comparing different environments, prompt strategies, and model configurations. Key findings include that the Kali Linux environment improves performance by 9.5 percentage points over Ubuntu, and Claude 4.5 Opus achieves the highest solve rate \(59%\). The study suggests that tooling and model selection are critical for success, while prompt engineering shows diminishing returns. The paper offers valuable insights into optimizing LLMs for offensive security tasks, making it worthwhile for readers interested in LLM applications in cybersecurity。
4. [TitanCA：通过协调大语言模型代理发现100多个CVE的经验教训](/202604/22/2604.17860v1-titanca-lessons-from-orchestrating-llm-agents-to-discover-100-cves)（7.8/10）
   摘要：TitanCA is a vulnerability discovery project that leverages orchestrated large language models \(LLMs\) to detect zero\-day vulnerabilities in open\-source software. The approach is organized into four modules: matching, filtering, inspection, and adaptation. TitanCA has discovered over 200 zero\-day vulnerabilities, resulting in 118 CVEs. The paper highlights how multi\-agent collaboration in LLMs improves vulnerability detection precision, offering a viable alternative to traditional security tools that suffer from high false\-positive rates. The method shows promise for future cybersecurity applications, but further refinement is needed to address model hallucinations and the specific adaptation to different deployment contexts。
5. [迈向最优的代理架构用于进攻性安全任务](/202604/22/2604.18718v1-towards-optimal-agentic-architectures-for-offensive-security-tasks)（7.8/10）
   摘要：本文将“多Agent架构是否值得”这一经验问题转化为可控系统实验，在20个真实可交互漏洞目标上构建基准，对5类拓扑、3类模型进行600次运行对比。结果显示性能受可观测性与任务域主导，白盒与Web任务显著更易；多Agent并非越多越好，成本\-效果呈非单调关系。MAS\-Indep在检测率最强，而单Agent在成本效率最优。对设计安全Agent系统具有直接参考价值，值得精读其实验设计与成本分析。
6. [NaviRAG：面向检索增强生成的主动知识导航](/202604/22/2604.12766v1-navirag-towards-active-knowledge-navigation-for-retrieval-augmented-generation)（7.5/10）
   摘要：本论文提出了NaviRAG，一种面向复杂长文问答的主动知识导航检索增强生成框架，通过将文档构建成分层语义结构，并结合多阶段动态检索策略，提高了多粒度证据定位与答案生成能力。实验显示在长文QA基准上，相比传统RAG，NaviRAG在召回率和生成性能上均有显著提升，值得继续精读理解其层级组织与导航机制。
7. [LoSA：用于块级扩散语言模型的局部感知稀疏注意力](/202604/22/2604.12056v1-losa-locality-aware-sparse-attention-for-block-wise-diffusion-language-models)（6.9/10）
   摘要：本研究提出了一种名为LoSA（Locality\-aware Sparse Attention）的方法，旨在优化块状扩散语言模型（DLMs）的内存效率和计算速度。传统的稀疏注意力方法在DLMs中受到KV膨胀问题的限制，LoSA通过重用稳定token的缓存前缀注意力结果，仅对活跃token进行稀疏注意力计算，从而显著减少了KV缓存的访问量，提高了速度和准确性。实验结果表明，LoSA在保持接近全密度的准确度的同时，提升了多达4.14倍的注意力计算速度，适用于各种DLM基准。值得继续精读。
8. [用于高效长上下文建模的潜在浓缩变换器](/202604/22/2604.12452v2-latent-condensed-transformer-for-efficient-long-context-modeling)（6.9/10）
   摘要：本文提出了Latent\-Condensed Attention \(LCA\)，在Multi\-head Latent Attention的低维潜在空间中压缩上下文表示，同时保持语义和位置信息，显著减少KV缓存和计算成本。实验显示，在128K上下文长度下，LCA可实现2.5倍预填速度提升和90% KV缓存减少，同时保持性能接近原模型，表明该方法在处理长上下文的LLM中非常高效，值得进一步精读。
9. [SLQ：通过共享潜在查询在冻结的多模态大语言模型中实现检索的跨模态桥接](/202604/22/2604.13710v1-slq-bridging-modalities-via-shared-latent-queries-for-retrieval-with-frozen-mllms)（6.9/10）
   摘要：本文提出了SLQ（共享潜在查询）框架，通过冻结大规模多模态语言模型（MLLM）并引入少量共享潜在查询，有效地将其适配为检索器，避免了侵入性调整对预训练语义空间的影响。实验结果表明，SLQ在COCO和Flickr30K数据集上优于全量微调和LoRA方法，并在KARR\-Bench基准测试中表现出色。本文的贡献在于通过简单高效的方法提升了MLLM的检索能力，适合需要知识推理的任务，值得精读。
10. [NeuroTrace：基于推理来源的对抗样本检测](/202604/22/2604.14457v1-neurotrace-inference-provenance-based-detection-of-adversarial-examples)（6.9/10）
   摘要：本文提出了一种基于推理溯源图（IPG）的方法来检测对抗样本，通过分析神经网络的推理过程捕捉信息流动，区分正常输入与对抗输入。NeuroTrace框架提供了可重复的模型执行提取引擎和多领域对抗攻击的基准数据集，验证了推理溯源图在多种攻击类型下的有效性。实验结果表明，该方法在不同类型的对抗攻击中具有很强的检测能力，且与现有方法相比性能更优。若关注对抗样本检测的高效方法，可继续细读。
11. [DDoS流量的时序与结构异常检测范式评估](/202604/22/2604.16575v1-evaluating-temporal-and-structural-anomaly-detection-paradigms-for-ddos-traffic)（6.9/10）
   摘要：本文探讨了针对DDoS攻击的无监督异常检测方法，提出了一种轻量级的决策框架，优先选择时间性或结构性特征。研究表明，在弱时间依赖的情况下，结构性特征比时间性特征更有效，且该框架能够帮助在模型选择前缩小特征空间范围。论文实验使用了两种具有统计差异的数据集，验证了不同特征选择对检测效果的影响。值得继续细读，以深入了解如何在不同数据集上选择合适的特征空间。

---
使用键盘方向键可在日报/论文之间快速切换。
