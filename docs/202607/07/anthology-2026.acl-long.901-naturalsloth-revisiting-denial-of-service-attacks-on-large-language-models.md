---
title: "NaturalSloth: Revisiting Denial-of-Service Attacks on Large Language Models"
title_zh: NaturalSloth：重新审视针对大语言模型的拒绝服务攻击
authors: "Yiming Chen, Zexin Li, Xianghu Yue, Robby T. Tan, Haizhou Li"
date: 2026-07-01
pdf: "https://aclanthology.org/2026.acl-long.901/"
tags: ["query:q9"]
score: 6.6
relevance_score: 2.5
quality_score: 8.5
reliability_score: 8.0
practicality_score: 7.5
evidence: 仅涉及LLM网络安全
tldr: 本论文探讨了大语言模型面临的一种新型拒绝服务（DoS）攻击，即通过使用看似无害但实际上不切实际的指令来诱导过度生成。研究者们构建了一个名为NaturalSloth的数据集，并展示其在多种模型上的有效性，同时指出现有防御措施的不足。这项研究值得进一步细读，以了解其方法论及潜在影响。
source: ACL-2026-Long
selection_source: fresh_fetch
motivation: 本研究旨在探讨如何利用自然指令对大语言模型实施拒绝服务攻击。
method: 通过引入自然、无害的指令来触发大语言模型的过度生成，从而实现拒绝服务攻击。
result: 实验表明，NaturalSloth能够在多种专有和开源的大语言模型上持续诱发过度生成，并且与越狱技术结合时攻击效果更佳。
conclusion: 若继续精读，建议重点关注实验部分和防御分析，因为这两部分提供了关键证据和对现有防御措施的评估。
key_findings: [自然指令可以有效触发大语言模型的过度生成，超出以往对抗性扰动的研究范围。, 设计了一个多代理合成框架，以扩展包含恶意意图和语义多样性的DoS提示数据集。, 现有防御措施在应对自然拒绝服务攻击时存在显著局限性，亟需专门保护措施。]
limitations: 论文主要集中于自然指令的攻击方式，未深入探讨其他潜在的防御机制或改进方案。
---

## 1. 问题与背景
大型语言模型（LLM）的服务依赖有限的计算资源，过长的生成过程会消耗更多 GPU 时间、增加响应延迟并降低多租户系统吞吐量，因此存在通过诱导模型进行过度生成而实施拒绝服务（DoS）攻击的风险。已有 LLM DoS 研究主要依赖对输入进行对抗扰动，使模型延迟生成结束标记。本文研究的问题是：无需明显恶意的扰动，仅通过自然、看似正常但包含不切实际或无意义任务的指令，是否也能触发 LLM 的过度生成并造成服务压力。

## 2. 核心思路 / 方法
论文提出 NaturalSloth，一个针对自然语言指令型 LLM DoS 攻击的对抗数据集，用于系统研究这种被忽视的漏洞。作者从人工整理的种子样本出发，覆盖多种攻击类别，并设计多智能体合成框架扩展数据规模，同时保持攻击意图并提升语义多样性。与依赖人工设计扰动或修改输入形式的传统方法相比，该方法强调利用自然、良性外观的指令直接诱导模型产生异常长文本生成。

## 3. 结果与结论
论文在多种专有和开源 LLM 上进行实验，结果显示 NaturalSloth 能够稳定诱导模型进行过度生成，并有效触发 DoS 风险。实验还发现，将该类攻击与越狱（jailbreak）技术结合后，攻击效果会进一步增强。作者据此指出，现有防御机制对自然型 DoS 攻击存在明显不足，需要设计专门的防护方法。

## 4. 局限与适用边界
从现有文本无法确认论文对具体防御方案、攻击成本或现实部署环境中的长期影响进行了多深入分析。该研究主要聚焦于通过自然指令诱导 LLM 过度生成的 DoS 场景，其结论适用于 LLM 服务资源消耗与安全防护研究领域。

## Abstract
LLM serving is limited by provider-side resources: longer generations consume more GPU time, increase latency, and reduce throughput in multi-tenant systems. This creates a denial-of-service (DoS) risk, where attackers degrade service by inducing excessive generation. Prior work on LLM DoS primarily relies on adversarial perturbations that delay end-of-sequence termination. We show perturbations are often unnecessary: natural, benign-looking instructions that specify impractical and meaningless tasks can already trigger excessive generation. To study this overlooked vulnerability, we introduce , an adversarial dataset of natural, instruction-based DoS prompts. Starting from a human-curated seed set spanning diverse attack categories, we design a multi-agent synthesis framework to scale the dataset while preserving malicious intent and increasing semantic diversity. Experiments across a wide range of proprietary and open-source LLMs show that NaturalSloth consistently induces excessive generation, with attack effectiveness further amplified when combined with jailbreak techniques. Our analysis also reveals significant limitations of existing defenses, highlighting the need for dedicated protections against natural DoS attacks.