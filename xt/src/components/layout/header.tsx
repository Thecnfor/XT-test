'use client'

import Link from "next/link";
import CheckNav from "@/components/universe/checkNav";
import AdminButton from "@/components/features/admin";

export default function Header() {

  return (
    <header>
        <div className="header-logo">
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
