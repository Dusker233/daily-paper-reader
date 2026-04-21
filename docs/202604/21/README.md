# 日报 · 2026-04-21

- 生成时间：2026-04-21 20:46:20 UTC
- 当次推荐总数：12
- 精读区：1
- 速读区：11

## 今日简报（AI）
今天完成了 12 篇文献的阅读，其中包括 1 篇精读和 11 篇速读。推荐关注隐私保护优化和长上下文建模的最新进展。建议进一步关注基于贝叶斯攻击图的动态风险评估及其在云网络中的应用。

## 精读区
1. [SafeLM：可信联邦大语言模型的统一隐私感知优化](/202604/21/2604.16606v1-safelm-unified-privacy-aware-optimization-for-trustworthy-federated-large-language-models)（8.3/10）
   摘要：SafeLM提出一个面向联邦大语言模型的统一安全优化框架，同时覆盖隐私保护、安全防护、减少幻觉与对抗鲁棒性四类关键问题。方法结合梯度智能二值化、Paillier同态加密、中位数自适应聚合与对比式grounding校准解码，在降低通信开销与梯度泄露风险的同时提升抗投毒与抗攻击能力。实验显示其在多类基准上显著提升安全检测与鲁棒性表现，并在隐私—效用—效率之间取得较优平衡，整体具有较强工程落地价值，值得进一步精读方法与假设部分。

## 速读区
1. [基于贝叶斯攻击图和过程挖掘的动态风险评估](/202604/21/2604.18080v1-dynamic-risk-assessment-by-bayesian-attack-graphs-and-process-mining)（7.9/10）
   摘要：本文提出将过程挖掘与贝叶斯攻击图结合，实现对网络攻击中漏洞利用概率的动态风险评估。通过对网络流量进行包级行为建模识别恶意模式，将证据反馈更新BAG的条件概率表，从而实时修正系统被入侵风险。在含CVE漏洞的测试床上验证，结果表明可有效识别漏洞是否被主动利用并提升风险评估动态性，具有一定应用价值，值得进一步精读实现细节。
2. [用于高效长上下文建模的潜在浓缩变换器](/202604/21/2604.12452v2-latent-condensed-transformer-for-efficient-long-context-modeling)（7.8/10）
   摘要：本研究提出了一种新的长文本建模方法，称为Latent\-Condensed Attention \(LCA\)，通过在低维潜在空间中进行上下文压缩，有效降低了计算成本和键值缓存大小。与现有的多头潜在注意力（MLA）方法相比，LCA不仅优化了内存效率，还减轻了计算复杂度，并能在128K上下文长度下实现2.5倍的预填充速度提升和90%的KV缓存减少。实验结果表明，LCA在性能上与现有模型相当，适用于长文本处理任务。此研究为LLM中长文本处理提供了高效的解决方案，值得深入研究。
3. [面向对抗性云网络的鲁棒半监督时序入侵检测](/202604/21/2604.12655v1-robust-semi-supervised-temporal-intrusion-detection-for-adversarial-cloud-networks)（7.8/10）
   摘要：本文针对云网络入侵检测中标注数据稀缺、流量非平稳以及对抗攻击污染未标注数据的问题，提出一种鲁棒半监督时间建模框架RSST\-NIDS，通过一致性正则、置信度伪标签与选择性时间不变性，在流级网络流量中利用时间结构抑制噪声与恶意样本影响。实验在CIC\-IDS2017、CSE\-CIC\-IDS2018与UNSW\-NB15等数据集上表明，该方法在低标注条件下相较多种监督与半监督方法均取得更优检测性能、泛化能力与鲁棒性，整体属于值得进一步精读的安全学习方向论文。
4. [MLDAS：面向软件定义网络安全的机器学习动态算法选择](/202604/21/2604.14957v1-mldas-machine-learning-dynamic-algorithm-selection-for-software-defined-networking-security)（7.8/10）
   摘要：本文提出了一种在软件定义网络\(SDN\)环境中，基于流量特征动态选择机器学习算法的入侵检测框架\(MLDAS\)，旨在提升网络安全性能。通过在Ryu控制器上实现轻量级ML模型，利用真实网络流量和仿真攻击数据进行实验，展示了其对DDoS攻击的高效检测能力。研究结果表明，该方法在实时性和准确性上表现突出，值得深入阅读其方法和实验设计。
5. [评估针对 DDoS 流量的时间性与结构性异常检测范式](/202604/21/2604.16575v1-evaluating-temporal-and-structural-anomaly-detection-paradigms-for-ddos-traffic)（7.8/10）
   摘要：本研究提出了一种轻量级的决策框架，用于在无监督 DDoS 检测中选择合适的时序或结构特征表示。通过两个诊断探针：滞后\-1 自相关和主成分分析（PCA）累计解释方差，来决定使用时序还是结构特征。实验表明，在时序依赖性较弱的情况下，结构特征表现更好。该框架帮助缩小表示选择范围，提高了部署时的适配性。实验结果支持结构特征的优越性，值得进一步关注其在实际环境中的应用。
6. [迈向深度加密训练：低延迟、内存高效和高吞吐量的隐私保护神经网络推理](/202604/21/2604.16834v1-towards-deep-encrypted-training-low-latency-memory-efficient-and-high-throughput-inference-for-privacy-preserving-neural-networks)（7.8/10）
   摘要：本研究旨在提升隐私保护神经网络的推理效率，提出了一种优化的批处理同态加密算法和管道架构。通过对ResNet\-20和ResNet\-34模型的实验，结果显示在处理512个加密图像时，推理时间和内存使用均显著优于现有技术。该论文值得深入阅读，尤其是对批处理方法及其性能提升的详细探讨。
7. [系统综述：重塑网络入侵检测系统的研究](/202604/21/2604.17556v1-sok-reshaping-research-on-network-intrusion-detection-systems)（6.9/10）
   摘要：本文对网络入侵检测系统（NIDS）研究进行了系统化反思，指出当前研究与实际应用存在脱节，提出三条关键断言以纠正误区，并通过可复现案例展示改进方法。论文强调从真实网络和操作实践出发，重新定义评估标准，为未来NIDS研究提供指导框架。值得继续精读以理解研究反思与推荐方法。
8. [RECIPER：一种面向过程材料问答的双视图检索管道](/202604/21/2604.11229v1-reciper-a-dual-view-retrieval-pipeline-for-procedure-oriented-materials-question-answering)（6.8/10）
   摘要：本研究提出了RECIPER，一种针对材料科学程序性问题的双视图检索管线，通过同时利用段落级上下文和大语言模型生成的步骤化摘要来改进检索效果。实验显示，该方法在多种密集检索骨干上均优于仅段落检索，显著提升Recall@1、nDCG@10和MRR指标，同时下游问答性能也有所改善，表明程序化摘要提供了有价值的互补信号。该方法值得对程序性材料问答方向的研究者深入阅读。
9. [针对数据中毒攻击的物联网入侵检测机器学习模型鲁棒性分析](/202604/21/2604.14444v1-robustness-analysis-of-machine-learning-models-for-iot-intrusion-detection-under-data-poisoning-attacks)（6.8/10）
   摘要：本文研究了物联网环境下机器学习入侵检测系统在数据投毒攻击下的鲁棒性，评估了随机森林、梯度提升机、逻辑回归和深度神经网络在三类真实IoT数据集上的表现。结果显示集成模型稳定性较好，而逻辑回归和深度神经网络在标签操控和异常点攻击下性能下降可达40%，显著影响检测精度和部署可靠性。研究提供了对抗性训练和特征级验证的重要性指引，值得精读以指导防御性IoT安全设计。
10. [MARCA：基于清单的多语言网页搜索基准](/202604/21/2604.14448v1-marca-a-checklist-based-benchmark-for-multilingual-web-search)（6.8/10）
   摘要：MARCA is a bilingual benchmark for evaluating multilingual web search capabilities in large language models \(LLMs\). The paper focuses on testing LLMs' ability to gather evidence from multiple web pages, verify information, and produce structured answers. The benchmark consists of 52 multi\-entity questions in both English and Portuguese, paired with checklist\-style rubrics. Experiments show significant performance differences across models and highlight that orchestration improves answer coverage. If you're interested in multilingual web search capabilities and benchmarking approaches for LLMs, this paper offers valuable insights, but it focuses mainly on Portuguese and English interactions。
11. [射频接收机架构中的AI赋能隐蔽信道检测](/202604/21/2604.14987v1-ai-enabled-covert-channel-detection-in-rf-receiver-architectures)（6.8/10）
   摘要：本研究针对无线芯片中的隐蔽信道问题，提出了一种基于AI的实时检测机制，通过压缩卷积神经网络监测RF接收器中的I/Q样本，实现高效且准确的CC识别。在SNR较高时表现优异，值得进一步细读以了解其具体实现和应用潜力。

---
使用键盘方向键可在日报/论文之间快速切换。
