'use client'

import CheckNav from "@/components/universe/checkNav";
import AdminButton from "@/components/features/admin";
import SwitchNav from "@/components/features/switchNav";

export default function Header() {

  return (
    <header>
        <div className="header-logo">
          <div>电脑行</div><span>.XT</span>
          <SwitchNav />
        </div>
        <nav>
            <AdminButton />
            <CheckNav />
        </nav>
    </header>
  );
}
