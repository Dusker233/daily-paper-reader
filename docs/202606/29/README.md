# 日报 · 2026-06-29

- 生成时间：2026-06-29 22:13:20 UTC
- 当次推荐总数：17
- 精读区：6
- 速读区：11

## 今日简报（AI）
今天集中梳理了大模型安全与可信生成相关研究进展，覆盖代码生成、记忆安全与后门攻击防护等方向。  
关键发现集中在安全代码生成的系统性问题、LLM长时记忆的投毒防护机制，以及后门与检索污染的检测与归因方法。  
后续建议重点关注数据与模型双层防护策略，以及可验证的安全评测框架在真实系统中的落地应用。

## 精读区
1. [SoK：AI安全代码生成：进展、问题与未来路径](/202606/29/2606.25195v1-sok-ai-secure-code-generation-progress-pitfalls-and-paths-forward)（8.5/10）
   摘要：本文系统化研究AI安全代码生成，提出KAUGE三层框架（知识\-执行\-差距），在OWASP/CERT安全原则基础上构建自然语言理解与可执行代码基准，系统评测多种模型与coding agent在函数级与Web应用级安全任务中的表现。结果显示模型对安全编码原则理解较强，但在实际代码中难以稳定落实，仍存在显著知识\-执行鸿沟，并进一步提出基于原则引导生成与评测的改进路径。
2. [防御LLM\-Agent长期记忆免受投毒攻击：具有机器可验证保证的不可篡改、源绑定权限机制](/202606/29/2606.24322v1-securing-llm-agent-long-term-memory-against-poisoning-non-malleable-origin-bound-authority-with-machine-checked-guarantees)（8.4/10）
   摘要：论文研究LLM代理长期记忆被投毒导致跨会话操控的问题，指出现有基于内容或溯源的防护均可被“洗白”攻击绕过。提出非可变的来源绑定权限与协同验证机制TMA\-NM，并给出形式化定理与机器验证证明。在多模型与多攻击通道基准中，现有方法最高达68%攻击成功率，而TMA\-NM实现0%成功率且不损失功能，具有较强参考价值，适合进一步精读。
3. [DoHFuse：一种采用DMAGLSTM的双分支架构，用于DNS over HTTPS/3（DoH/3）环境下的网站指纹识别](/202606/29/2606.24105v1-dohfuse-a-dual-branch-architecture-with-dmaglstm-for-website-fingerprinting-over-dns-over-https3)（8.3/10）
   摘要：提出DoHFuse用于DoH/3加密DNS流量的网站指纹识别，通过双分支融合统计特征与DMAG\-LSTM时序建模捕捉QUIC环境下的突发对齐模式；构建首个真实DoH/3数据集（449类），闭集准确率88.05%，开集AUPRC 0.975，说明现有填充机制难以有效防护，方法与数据集均具参考价值，值得进一步精读。
4. [5G O\-RAN中的跨层入侵检测：融合无线遥测与网络流记录的收益与局限](/202606/29/2606.22450v1-cross-layer-intrusion-detection-in-5g-o-ran-gains-and-limits-of-fusing-radio-telemetry-with-network-flow-records)（8.3/10）
   摘要：研究在5G O\-RAN场景下，将CU网络流量与DU无线电遥测进行跨层融合用于入侵检测，系统评估7种模型与多种融合策略。结果表明单独无线电特征已可匹敌甚至优于流量特征，融合仅在少数模型低误报阈值下带来有限收益，多数情况下反而不提升。DoS与正常流混淆顽固存在，提示窗口化统计表示存在瓶颈，整体属于偏实证评估型论文，具有一定参考价值。
5. [BipBipCache：在嵌入式缓存控制器中面向流水线感知的低延迟可调分组加密集成](/202606/29/2606.23941v1-bipbipcache-pipeline-aware-integration-of-low-latency-tweakable-encryption-in-an-embedded-cache-controller)（8.2/10）
   摘要：本文提出BipBipCache，将BipBip可调分组密码集成到嵌入式直接映射缓存控制器中，实现数据与标签实时加密以抵御冷启动与物理内存读取攻击。作者重新实现首个BipBip硬件加密器，并设计流水线感知结构，使6周期加密的写入延迟通过与标签解密重叠降至有效3周期。FPGA实验显示可在Artix\-7上稳定运行且资源开销可控，证明低延迟缓存加密可工程化落地，具有一定精读价值。
6. [基于动态城市拥塞融合的参数高效混合Transformer（PEHT）用于网络流量预测](/202606/29/2606.28274v1-parameter-efficient-hybrid-transformer-peht-for-network-traffic-prediction-via-dynamic-urban-congestion-integration)（8.1/10）
   摘要：本文针对动态城市环境下蜂窝网络流量预测难以融合外部移动性与拥塞因素的问题，提出参数高效混合 Transformer（PEHT）。该方法将网络通信特征与城市交通特征分离处理，在 Transformer 编码器中引入 LoRA 降低可训练参数，并通过多模态融合将拥塞信息注入解码阶段。实验基于 Telecom Italia Milan 数据集及合成拥塞场景，显示 PEHT 在 RMSE、MAE 和 R² 指标上优于已有方法。论文提出的结构设计具有一定新颖性，值得进一步细读。

## 速读区
1. [继承的电路，学习到的语义：微调如何产生标准评估无法发现的规避漏洞](/202606/29/2606.27091v1-inherited-circuits-learned-semantics-how-fine-tuning-creates-evasion-vulnerabilities-invisible-to-standard-evaluation)（8.0/10）
   摘要：论文研究大模型安全分类微调在PowerShell恶意检测中引入的隐蔽规避脆弱性。通过因果干预与电路分析发现微调并未创造新电路，而是强化继承的晚期注意力路径并绑定指示token语义，导致在别名替换、表达式重构与大小写变形等保持行为等价的变换下显著失效。作者提出基于激活线性探针与指示token符号检验的预部署监测方法，可在未生成对抗样本前预测脆弱命令族。结果显示标准同分布评估会高估安全分类器鲁棒性，值得进一步精读。
2. [SCRUB\-FL：通过后门遗忘进行表示的净化与清洗](/202606/29/2606.22700v1-scrub-fl-sanitizing-and-cleansing-representations-via-unlearning-of-backdoors)（7.9/10）
   摘要：本文针对联邦学习中后门攻击在训练完成后难以彻底清除的问题，提出SCRUB\-FL方法。该方法结合客户端异常样本检测（谱分析与激活聚类）与WGAN\-GP建模潜在触发分布，并在服务器端生成触发近似样本执行机器遗忘，从而在无需真实数据与触发知识的情况下实现后门清洗。实验在CIFAR\-10与GTSRB上验证，在多种攻击与高达40%恶意参与下，将攻击成功率降至3.88%，同时保持91%以上准确率，整体效果显著，值得进一步精读。
3. [基于词元影响归因的中毒检索语料中目标答案追踪](/202606/29/2606.25721v1-tracing-target-answers-in-poisoned-retrieval-corpora-via-token-influence-attribution)（7.9/10）
   摘要：本文提出TRACE，用于RAG投毒检测，通过对目标LLM进行token影响归因（梯度反传）挖掘检索文档中的高影响词，并检测其在多文档中的重复出现，从而识别被污染语料，同时还能反推出攻击者设定的目标答案。在3个问答基准与6种LLM上验证，表现出较高检测性能且计算开销较低，整体具有较强实用价值，值得进一步精读。
4. [通过自适应准高斯采样实现多模态大语言模型的快速高效长视频理解](/202606/29/2606.24187v2-towards-fast-and-effective-long-video-understanding-of-multimodal-large-language-models-via-adaptive-quasi-gaussian-sampling)（7.8/10）
   摘要：论文提出AdaQ，一种无需训练的自适应准高斯采样方法，用于长视频理解中的关键帧选择。通过利用查询\-帧相似度方差动态调整3σ区间，实现对局部与全局任务的自适应取帧，在仅64帧输入下显著提升多种MLLM性能并优于现有方法，整体具备较高实用价值，值得精读。
5. [NetPTR：稀疏网络上最优差分隐私谱社区检测](/202606/29/2606.26145v1-netptr-optimal-differentially-private-spectral-community-detection-on-sparse-networks)（7.8/10）
   摘要：本文研究稀疏网络中谱聚类的差分隐私问题，提出NetPTR框架，通过稳定性证书筛选可发布的谱嵌入并加噪，实现边级DP及双部图列节点DP。在度校正SBM下给出误差分解与一致性结果，并证明隐私预算近最优，同时扩展到双部图并验证隐私\-精度权衡，整体方法体系完整，值得进一步精读。
6. [从 CVE 到 CWE：基于系统调用的 HIDS 泛化](/202606/29/2606.22581v1-from-cve-to-cwe-syscall-based-hids-generalisation)（7.6/10）
   摘要：本文研究基于系统调用的主机入侵检测系统\(HIDS\)能否从单个CVE泛化到同一CWE类别的新CVE。作者在LID\-DS\-2021的三类CWE场景上，使用66维特征与Isolation Forest/One\-Class SVM，并以固定FPR校准阈值进行跨CVE迁移评估。结果显示仅CWE\-307表现较好（F1≈0.70），其余类别显著崩溃，且迁移强烈方向依赖，说明CWE级泛化有限但部分可行，值得精读。
7. [基于注意力机制的现实环境中恶意智能体技能检测](/202606/29/2606.23416v1-detecting-malicious-agent-skills-in-the-wild-using-attention)（7.6/10）
   摘要：论文针对LLM agent技能市场中恶意技能难以检测的问题，提出Locate\-and\-Judge两阶段方法：用轻量模型基于注意力定位可疑结构片段，再用大模型精判，从而在大幅降低成本的同时实现可扩展审计。在134k技能扫描中检出131个恶意技能（83%精度），证明该方法在接近全量扫描效果下显著优于传统关键词与正则及直接LLM扫描，具有较强实用价值，值得进一步细读。
8. [EG\-VQA：基于时序证据支撑的可验证视频问答基准评测](/202606/29/2606.24797v1-eg-vqa-benchmarking-verifiable-video-question-answering-with-grounded-temporal-evidence)（7.6/10）
   摘要：论文提出EG\-VQA证据驱动视频问答基准，要求模型在回答问题的同时输出时间定位证据，并构建统一评测指标EG\-F1与方法EG\-Reasoner。数据集包含2067个视频与11838个问答对，覆盖多类推理任务。实验发现现有强视频大模型虽然答题准确，但证据定位能力显著不足，暴露出“答对不等于理解”的问题。整体方法与评测体系完整，具有较高精读价值。
9. [CITADEL：基于CSI的工业物联网（IIoT）网络干扰检测与开放集分类](/202606/29/2606.22939v1-citadel-csi-based-jamming-detection-and-open-set-classification-for-iiot-networks)（6.9/10）
   摘要：本文针对工业物联网无线网络中射频干扰攻击难以兼顾检测、未知攻击识别与边缘部署的问题，提出基于Wi\-Fi信道状态信息（CSI）的两阶段检测框架CITADEL。系统先在ESP32等终端进行轻量筛查，再在边缘GPU完成已知攻击分类与未知攻击检测，并增强对对抗攻击的鲁棒性。实验显示其在已知攻击、零日攻击检测率、误报率及实时性方面均优于现有方法，若关注IIoT无线安全或CSI应用，值得进一步精读。
10. [中间层知道什么：基于熵动力学的越狱攻击检测](/202606/29/2606.25182v1-what-intermediate-layers-know-detecting-jailbreaks-from-entropy-dynamics)（6.9/10）
   摘要：研究LLM越狱检测问题，提出基于logit lens提取中间层token级预测熵轨迹的方法，发现动态单调趋势比静态统计更有效，且信号集中在中间层，在多模型多基准上无需训练即可区分越狱与安全提示，具有较强分析价值但更偏诊断而非完整防御方案。
11. [Chai：面向密码学误用漏洞的智能体式发现](/202606/29/2606.26933v1-chai-agentic-discovery-of-cryptographic-misuse-vulnerabilities)（6.9/10）
   摘要：本文提出Chai，一个用于密码学误用漏洞发现的AI代理系统，通过将AI与差分测试结合，在无明确安全“真值判定器”的情况下利用自然差异信号定位问题，并沿密码库依赖图传播这些差异以提升发现效率。系统在X.509、JWT、SAML等场景中运行，发现100\+漏洞并挖掘出影响广泛SSL库的关键漏洞，展示出跨应用规模化漏洞挖掘能力，整体方法具有较强实用价值，值得进一步精读。

---
使用键盘方向键可在日报/论文之间快速切换。
