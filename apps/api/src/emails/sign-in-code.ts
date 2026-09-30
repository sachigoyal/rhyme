export function signInCodeEmail(code: string) {
  return {
    subject: `${code} is your Rhyme sign-in code`,
    text: `Your Rhyme sign-in code is ${code}. It expires in 10 minutes. If you didn't request it, you can ignore this email.`,
    html: `<!doctype html>
<html>
  <body style="margin:0;padding:40px 16px;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#171717">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border:1px solid #e5e5e5;border-radius:16px;padding:40px">
          <tr><td style="font-size:15px;font-weight:600;letter-spacing:-0.01em">Rhyme</td></tr>
          <tr><td style="padding-top:28px;font-size:22px;font-weight:600;letter-spacing:-0.02em">Your sign-in code</td></tr>
          <tr><td style="padding-top:8px;font-size:14px;line-height:22px;color:#737373">Enter this code to continue. It expires in 10 minutes.</td></tr>
          <tr><td style="padding-top:28px">
            <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:600;letter-spacing:0.3em;background:#f5f5f5;border-radius:12px;padding:18px 0;text-align:center">${code}</div>
          </td></tr>
          <tr><td style="padding-top:28px;font-size:12px;line-height:18px;color:#a3a3a3">If you didn't request this, you can safely ignore this email.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  }
}
