'use client'

import Link from "next/link";
import CheckNav from "@/components/universe/checkNav";
import AdminButton from "@/components/features/admin";
import SwitchChat from "@/components/universe/ChatHistoryButton";

export default function Header() {

  return (
    <header>
        <div className="header-logo">
          <SwitchChat />
          <Link href="/">
            <div>XRAK</div><span>.CO</span>
          </Link>
        </div>
        <nav className="header-nav">
            <AdminButton />
            <CheckNav />
        </nav>
    </header>
  );
}
