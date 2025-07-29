'use client'

import Link from "next/link";
import CheckNav from "@/components/universe/checkNav";
import AdminButton from "@/components/features/admin";

export default function Header() {

  return (
    <header>
        <div className="header-logo">
          <Link href="/">
            <div>电脑行</div><span>.XT</span>
          </Link>
        </div>
        <nav>
            <AdminButton />
            <CheckNav />
        </nav>
    </header>
  );
}
