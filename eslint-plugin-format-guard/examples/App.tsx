import React, { useState } from "react";

declare function formatCount(value: number): string;
declare function formatDate(value: string): string;

type Response = {
  data: {
    userCount: number;
    user: { profile: { createdDate: string } };
  };
};

export function App({ response, isActive }: { response: Response; isActive: boolean }) {
  const [additionalCount, setAdditionalCount] = useState(0);
  const { userCount } = response.data;
  const totalCount = userCount + additionalCount; // OK: JSX 바깥 계산

  return (
    <div>
      {/* ✅ 정상 */}
      <p>{userCount.toLocaleString()}</p>
      <p>{formatCount(userCount + additionalCount)}</p>
      <p>{formatDate(response.data.user.profile.createdDate)}</p>
      <p>{isActive ? userCount.toLocaleString() : formatCount(totalCount)}</p>
      <p>{`총 ${totalCount.toLocaleString()}명`}</p>
      <button onClick={() => setAdditionalCount(additionalCount + 1)}>+</button>

      {/* ❌ 경고 */}
      <p>{userCount}</p>
      <p>{response.data.user.profile.createdDate}</p>
      <p>{response?.data?.userCount}</p>
      <p>{String(userCount)}</p>
      <p>{formatDate(userCount)}</p>
      <p>{userCount.toLocaleString() + additionalCount}</p>
      <p>{isActive ? userCount.toLocaleString() : totalCount}</p>
      <p>{`총 ${userCount}명`}</p>
    </div>
  );
}
