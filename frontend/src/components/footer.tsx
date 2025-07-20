import "@/styles/components/footer.scss";
import Image from 'next/image';

export default function Footer(){
    return(
        <>
            <div className="footer">
                <Image
                    src="/policy.png"
                    width={16}
                    height={16}
                    alt="公安备案"
                />
                <a href="https://beian.mps.gov.cn/#/query/webSearch?code=44200102445584" rel="noreferrer noopener" target="_blank">粤公网安备44200102445584号</a>
            </div>
        </>
    )
}