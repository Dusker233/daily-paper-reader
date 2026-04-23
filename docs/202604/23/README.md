# 日报 · 2026-04-23

- 生成时间：2026-04-23 20:56:28 UTC
- 当次推荐总数：17
- 精读区：6
- 速读区：11

## 今日简报（AI）
今天我们成功发布了17篇文章，涵盖前沿大语言模型在网络安全领域的应用。值得关注的是，系统能力基准测试和检索增强的漏洞探索网络为内存腐败分析提供了新思路。建议读者关注这些研究，以提升对网络安全风险的理解和应对能力。

## 精读区
1. [前沿大型语言模型在进攻性网络任务中的系统能力基准评估](/202604/23/2604.17159v1-systematic-capability-benchmarking-of-frontier-large-language-models-for-offensive-cyber-tasks)（8.4/10）
   摘要：本研究通过对10种前沿大型语言模型进行系统评估，探讨其在200个网络安全挑战中的表现，发现Kali Linux环境显著提升了解决率，而自动提示策略则可能降低性能。这些发现为未来的网络安全应用提供了重要参考，因此值得继续细读。
2. [RAVEN：用于用户代码和二进制程序内存损坏分析的检索增强漏洞探索网络](/202604/23/2604.17948v1-raven-retrieval-augmented-vulnerability-exploration-network-for-memory-corruption-analysis-in-user-code-and-binary-programs)（8.4/10）
   摘要：本研究提出了RAVEN框架，结合大语言模型和检索增强生成技术，自动化生成漏洞分析报告。通过四个模块，该框架能够识别漏洞、评估影响并生成结构化报告。实验结果显示，RAVEN在105个样本上获得了54.21%的平均质量评分，表明其在自动化文档编制方面具有潜力，但仍需进一步优化。
3. [跨域查询翻译用于网络故障排除：具有隐私保护和自我反思的多智能体大语言模型框架](/202604/23/2604.13353v1-cross-domain-query-translation-for-network-troubleshooting-a-multi-agent-llm-framework-with-privacy-preservation-and-self-reflection)（8.2/10）
   摘要：本研究提出了一种多智能体大语言模型框架，用于网络故障排查中的跨域查询翻译，强调隐私保护与自我反思机制。通过实验证明，该方法能显著提高故障定位效率，值得进一步细读以了解其具体实现与应用场景。
4. [朝向深度加密训练：低延迟、内存高效和高吞吐量的隐私保护神经网络推理](/202604/23/2604.16834v1-towards-deep-encrypted-training-low-latency-memory-efficient-and-high-throughput-inference-for-privacy-preserving-neural-networks)（8.1/10）
   摘要：本研究旨在提升隐私保护机器学习中同态加密神经网络的推理效率，提出了一种优化算法和管道架构以支持批量处理。通过对ResNet\-20和ResNet\-34模型的评估，研究显示该方法在处理512个加密图像时，推理时间减少了1.78倍，内存使用降低了3.74倍。这些结果表明该方法在高吞吐量场景下具有显著优势，值得进一步细读。
5. [基于贝叶斯攻击图与过程挖掘的动态风险评估](/202604/23/2604.18080v1-dynamic-risk-assessment-by-bayesian-attack-graphs-and-process-mining)（8.1/10）
   摘要：本研究提出了一种结合贝叶斯攻击图（BAG）和过程挖掘技术的方法，用于动态评估网络系统中的风险。通过对恶意流量进行分析，该方法能够实时更新漏洞利用的概率，并在模拟环境中有效识别出多种CVE漏洞的利用情况。这一创新方法值得进一步细读，以了解其在实际应用中的潜力和局限性。
6. [TL\-RL\-FusionNet：一种自适应高效的强化学习驱动迁移学习框架，用于检测不断演变的勒索软件威胁](/202604/23/2604.20260v1-tl-rl-fusionnet-an-adaptive-and-efficient-reinforcement-learning-driven-transfer-learning-framework-for-detecting-evolving-ransomware-threats)（8.0/10）
   摘要：本研究提出了一种名为TL\-RL\-FusionNet的框架，结合了强化学习和迁移学习，以应对现代勒索软件的动态特性。通过使用冻结的双重迁移学习骨干网络作为特征提取器，并由轻量级残差多层感知机分类器进行分类，该框架能够自适应地调整样本权重，从而提高检测准确性。实验结果显示，该方法在1000个样本上达到了99.1%的准确率，显著优于传统模型，且训练效率更高，因此值得进一步细读。

## 速读区
1. [TitanCA：从协调大型语言模型代理发现100多个CVE的经验](/202604/23/2604.17860v1-titanca-lessons-from-orchestrating-llm-agents-to-discover-100-cves)（8.0/10）
   摘要：本研究介绍了TitanCA项目，该项目通过协调多个大语言模型（LLM）代理，建立了一个统一的漏洞发现管道，成功发现了203个零日漏洞并发布了118个CVE。研究表明，相较于传统的静态应用安全测试工具，TitanCA在漏洞检测上具有更高的准确性和效率，值得深入阅读以了解其技术细节和应用效果。
2. [超越不可区分性：测量LLM API中的提取风险](/202604/23/2604.18697v1-beyond-indistinguishability-measuring-extraction-risk-in-llm-apis)（8.0/10）
   摘要：本文研究LLM API中“不可区分性”\(如DP或MIA\)与真实数据抽取风险之间的关系，指出二者既非充分也非必要条件，并提出新的\(l,b\)\-inextractability定义来刻画黑盒API中对n\-gram抽取的查询成本约束。同时构建基于rank的抽取风险估计器，可统一覆盖精确/近似/无目标抽取，并在不同模型与解码策略上验证其比传统MIA或经验抽取指标更稳健，适合关注LLM隐私与记忆风险的读者精读。
3. [网络防御基准：针对SecOps中大型语言模型的主动威胁狩猎评估](/202604/23/2604.19533v2-cyber-defense-benchmark-agentic-threat-hunting-evaluation-for-llms-in-secops)（8.0/10）
   摘要：本文提出Cyber Defense Benchmark，用于评估LLM代理在SOC威胁狩猎中的能力。基于真实Windows日志与MITRE攻击流程构建无引导的SQL查询环境，要求模型自主发现恶意时间戳。实验显示主流模型覆盖率仅约0.55，且无模型达到每个战术≥50%召回，说明当前LLM在开放式威胁狩猎任务中仍明显不足，值得关注但需谨慎精读方法与评测设计。
4. [SoK：重塑网络入侵检测系统研究](/202604/23/2604.17556v1-sok-reshaping-research-on-network-intrusion-detection-systems)（7.9/10）
   摘要：本论文旨在探讨网络入侵检测系统（NIDS）研究与实际应用之间的脱节，并提出三项主张以指导未来的研究方向。作者通过反思现有文献和案例分析，强调应重视基本安全原则和现代网络特性，以提升NIDS的有效性和可信度。这篇文章值得细读，以获取对未来NIDS研究的重要见解。
5. [MLDAS：用于软件定义网络安全的机器学习动态算法选择](/202604/23/2604.14957v1-mldas-machine-learning-dynamic-algorithm-selection-for-software-defined-networking-security)（7.8/10）
   摘要：本文提出MLDAS，将机器学习与SDN入侵检测结合，通过依据实时网络流量特征动态选择最合适的分类算法来提升DDoS攻击检测的鲁棒性与适应性。系统部署于Ryu控制器，并利用Mininet仿真结合真实攻击工具构建数据集，同时结合特征分析与超参数优化以减少过拟合风险。实验表明该方法在SDN环境中具有较高检测性能与实用价值，适合进一步深入阅读其机制与实验设计。
6. [SecureRouter：高效安全推理的加密路由](/202604/23/2604.15499v1-securerouter-encrypted-routing-for-efficient-secure-inference)（7.8/10）
   摘要：论文针对MPC安全推理中单一固定Transformer带来的高延迟与资源浪费问题，提出SecureRouter框架，在加密环境下引入输入自适应模型路由机制。方法结合MPC代价感知路由器与协同优化的加密模型池，在不泄露输入与路由决策的前提下动态选择不同规模模型执行推理，从而平衡效率与精度。实验在GLUE任务上实现约1.95×推理加速且几乎无精度损失，显示出良好的实用潜力，值得进一步精读其代价建模与路由设计细节。
7. [DEMUX：面向多标签网站指纹识别的边界感知多尺度流量去混合](/202604/23/2604.15677v1-demux-boundary-aware-multi-scale-traffic-demixing-for-multi-tab-website-fingerprinting)（7.8/10）
   摘要：本研究提出了DEMUX，一个针对多标签网站指纹识别的新框架，通过边界保持聚合、多尺度CNN和Transformer编码器解决了现有方法在处理重叠流量时的局限性。实验结果显示，DEMUX在多个评估场景中均表现出色，值得进一步细读以了解其技术细节和应用潜力。
8. [多智能体大语言模型系统中的联结提示攻击](/202604/23/2604.16543v1-conjunctive-prompt-attacks-in-multi-agent-llm-systems)（7.8/10）
   摘要：本文研究多智能体LLM系统中的合取式提示攻击：攻击者在用户查询中植入触发关键片段，在被入侵的远端代理中嵌入隐蔽模板，两者单独均表现正常，但在跨代理路由汇聚后触发恶意行为。作者提出路由感知的纯prompt优化攻击框架，在星型、链式与DAG拓扑中均显著提升攻击成功率，同时保持较低误触发率，并揭示现有Guard模型与系统级防护难以识别这种跨组件组合威胁。整体工作聚焦结构性安全漏洞，具有较强安全研究参考价值，值得进一步精读方法与评估部分。
9. [通过基于梯度的样本选择实现持续安全对齐](/202604/23/2604.17215v1-continual-safety-alignment-via-gradient-based-sample-selection)（6.9/10）
   摘要：本研究探讨了大型语言模型在持续适应新任务时如何保持安全性对齐，提出了一种基于梯度的样本选择方法，以过滤高梯度样本，从而减少对齐漂移。实验证明，该方法在多个模型和任务上显著提高了安全性保持，同时不需要额外的安全数据或架构修改，值得深入阅读。
10. [RARE：针对高相似度语料库的冗余感知检索评估框架](/202604/23/2604.19047v1-rare-redundancy-aware-retrieval-evaluation-framework-for-high-similarity-corpora)（6.9/10）
   摘要：本研究提出了RARE框架，旨在解决现有QA基准在高冗余文档中的评估失效问题。通过将文档分解为原子事实并使用CRRF增强数据生成，RARE能够更准确地反映真实世界的检索条件。实验表明，在金融、法律和专利领域，强基线检索器的表现显著下降，揭示了当前基准未能捕捉的鲁棒性差距。该框架为构建领域特定的RAG评估提供了新的思路，值得深入阅读。
11. [FAST：一种注意力与状态空间模型的协同框架用于时空交通预测](/202604/23/2604.13453v1-fast-a-synergistic-framework-of-attention-and-state-space-models-for-spatiotemporal-traffic-prediction)（6.8/10）
   摘要：本文提出FAST框架用于交通时空预测，核心结合时间注意力机制与Mamba状态空间模型进行空间依赖建模，并通过Temporal\-Spatial\-Temporal结构实现交替融合，同时引入多源时空嵌入与分层跳连预测以增强表达能力。在PeMS04/07/08数据集上整体优于多类Transformer、GNN与Mamba基线，在精度与可扩展性之间取得较优平衡，具有一定工程与研究价值，值得进一步精读其结构设计细节。

---
使用键盘方向键可在日报/论文之间快速切换。
