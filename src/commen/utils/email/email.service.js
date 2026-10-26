import {
  getCacheValue,
  getConfirmEmailKey,
  getConfirmEmailTrialsKey,
  incrKey,
  setCacheValue,
} from "../../cache/cache.service.js";
import { createOTP } from "../../OTP.js";
import { hashValue } from "../../security/hashing.js";
import { transporter } from "./email.config.js";
import { emailTemplate } from "./email.template.js";

export async function sendEmail({
  from = '"Example Team" <khaledsharaf153@gmail.com>',
  to,
  subject,
  html,
  attachments,
}) {
  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      attachments,
      // attachments: [
      //   {
      //     filename: "test.txt",
      //     content: "this for test",
      //     contentType: "text/plain",
      //   },
      // ],
    });
  } catch (err) {
    console.error("Error while sending mail:", err);
  }
}

export async function sendOTP({ email, subject }) {
  const otp = createOTP();
  await sendEmail({
    to: email,
    subject,
    html: emailTemplate[subject](otp),
  });

  await setCacheValue(getConfirmEmailKey(email), await hashValue(otp), {
    expiration: { type: "EX", value: 180 },
  });

  if (await getCacheValue(getConfirmEmailTrialsKey(email))) {
    await incrKey(getConfirmEmailTrialsKey(email));
  } else {
    await setCacheValue(getConfirmEmailTrialsKey(email), 1, {
      expiration: { type: "EX", value: 15 * 60 },
    });
  }
}
