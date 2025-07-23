'use client'
import "@/styles/components/mainPage.scss"
import React from "react";
import { TextAnimate } from "@/components/magicui/text-animate";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { Carousel, Card } from "@/components/ui/apple-cards-carousel";
import { BentoGrid, BentoGridItem } from "@/components/ui/bento-grid";
import {
  IconArrowWaveRightUp,
  IconBoxAlignRightFilled,
  IconBoxAlignTopLeft,
  IconClipboardCopy,
  IconFileBroken,
  IconSignature,
  IconTableColumn,
} from "@tabler/icons-react";
//

function BentoGridDemo() {
  return (
    <BentoGrid>
      {items.map((item, i) => (
        <BentoGridItem
          key={i}
          title={item.title}
          description={item.description}
          header={item.header}
          icon={item.icon}
          className={i === 3 || i === 6 ? "md:col-span-2" : ""}
        />
      ))}
    </BentoGrid>
  );
}
const Skeleton = () => (
  <div className="flex flex-1 w-full h-full min-h-[6rem] rounded-xl bg-gradient-to-br from-neutral-200 from-neutral-900 to-neutral-800 to-neutral-100">

  </div>
);
const items = [
  {
    title: "创新的黎明",
    description: "探索从微小灵感萌芽到改变世界的革命性发明的诞生历程，见证人类智慧如何突破界限，开启全新可能性。",
    header: <Skeleton />,
    icon: <IconClipboardCopy className="h-4 w-4 text-indigo-400" />,
  },
  {
    title: "数字革命浪潮",
    description: "深入探讨数字技术如何重塑我们的生活、工作与交流方式，从互联网普及到人工智能崛起，每一步都在改写人类文明的进程。",
    header: <Skeleton />,
    icon: <IconFileBroken className="h-4 w-4 text-emerald-400" />,
  },
  {
    title: "设计的艺术与哲学",
    description: "发现如何在美学与功能之间找到完美平衡，探索优秀设计如何潜移默化地影响我们的情绪、行为与生活质量。",
    header: <Skeleton />,
    icon: <IconSignature className="h-4 w-4 text-amber-400" />,
  },
  {
    title: "沟通的力量与艺术",
    description: "理解有效沟通如何打破壁垒、建立连接，从语言到非语言，从个人对话到全球传播，沟通是人类协作与进步的基石。",
    header: <Skeleton />,
    icon: <IconTableColumn className="h-4 w-4 text-rose-400" />,
  },
  {
    title: "知识的无尽探索",
    description: "加入这场跨越时空的求知之旅，从古代哲学到现代科学，每一次提问与发现都让我们更接近宇宙与自身的真相。",
    header: <Skeleton />,
    icon: <IconArrowWaveRightUp className="h-4 w-4 text-sky-400" />,
  },
  {
    title: "创造的喜悦与魔力",
    description: "体验将抽象想法转化为具体存在的奇妙过程，从艺术创作到技术发明，创造是人类表达自我、改变世界的最有力方式。",
    header: <Skeleton />,
    icon: <IconBoxAlignTopLeft className="h-4 w-4 text-purple-400" />,
  },
  {
    title: "冒险精神与未知探索",
    description: "踏上充满不确定性的旅程，探索未被征服的领域，冒险不仅是地理上的开拓，更是思想与心灵的突破与成长。",
    header: <Skeleton />,
    icon: <IconBoxAlignRightFilled className="h-4 w-4 text-orange-400" />,
  },
];

//
function AppleCardsCarouselDemo() {
  const cards = data.map((card, index) => (
    <Card key={card.src} card={card} index={index} layout={true} />
  ));
  return (
    <div className="w-full h-full py-20">
      <Carousel items={cards} />
    </div>
  );
}
const DummyContent = () => {
  return (
    <>
      <div
        key={"dummy-content"}
        className="bg-[#F5F5F7] p-8 md:p-14 rounded-3xl mb-4"
      >
        <p className="text-neutral-600 text-base md:text-2xl font-sans max-w-3xl mx-auto">
          <span className="font-bold text-neutral-700">
            345
          </span>
        </p>
      </div>
    </>
  );
};
const data = [
  {
    category: "快速开始",
    title: "你可以使用更加智能的AI",
    content: <DummyContent />,
  },
    {
    category: "快速开始",
    title: "新手入门",
    content: <DummyContent />,
  },
    {
    category: "快速开始",
    title: "加快办公效率",
    content: <DummyContent />,
  },
];

//
export default function Main() {
  const placeholders = [
    "电脑怎么用？",
    "Excel怎么快速完成工作？",
  ];
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log(e.target.value);
  };
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("submitted");
  };

  return (
    <main>
      <div className="main">
        <div className="main-container">
            <div className="main-content">
              <TextAnimate animation="blurInUp" by="character">
                解决日常问题++
              </TextAnimate>
              <div className="main-content-desc">
                <TextAnimate animation="fadeIn" by="line" as="p">
                  {'解锁高效办公技巧\n\nAI实用指南'}
                </TextAnimate>
              </div>
            </div>
            <div className="main-container-marquee">
              <PlaceholdersAndVanishInput
                placeholders={placeholders}
                onChange={handleChange}
                onSubmit={onSubmit}
              />
            </div>
        </div>
        <div className="main-tabs">
          <AppleCardsCarouselDemo />
        </div>
      </div>
      <div className="content">
          <div className="content-desc">
            <BentoGridDemo />
          </div>
      </div>
    </main>
  )
}