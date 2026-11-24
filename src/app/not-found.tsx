import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="locked-panel">
      <h2>这篇笔记不在公开索引里</h2>
      <p>
        可能它被标记为私密、已被移除，或链接拼写不对。私密笔记只以密文形式存在，公开页面不会出现它的标题。
      </p>
      <Link href="/" className="btn primary">
        回到首页
      </Link>
    </div>
  );
}
