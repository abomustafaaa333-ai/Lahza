import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";

const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl
  ? new Intl.DisplayNames(["ar"], { type: "region" })
  : null;

export type CountryCallingOption = {
  code: CountryCode;
  name: string;
  dialCode: string;
};

export const countryCallingCodes: CountryCallingOption[] = getCountries()
  .map(code => ({
    code,
    name: regionNames?.of(code) || code,
    dialCode: getCountryCallingCode(code),
  }))
  .sort((a, b) => {
    if (a.code === "SY") return -1;
    if (b.code === "SY") return 1;
    return a.name.localeCompare(b.name, "ar");
  });

export const DEFAULT_COUNTRY_CODE: CountryCode = "SY";
export const DEFAULT_COUNTRY_CALLING_CODE = "963";
