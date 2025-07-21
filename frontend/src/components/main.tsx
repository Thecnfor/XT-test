'use client'
import "@/styles/components/mainPage.scss"
import { TextAnimate } from "@/components/magicui/text-animate";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";

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
        </div>
      </div>
      <div className="content">
          <div className="content-desc">
            <TextAnimate animation="blurInUp" by="character">
              测试阶段
            </TextAnimate>
          </div>
      </div>
    </main>
  )
}