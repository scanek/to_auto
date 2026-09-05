"""
VIN Decoder Service
Provides accurate vehicle specifications (Make, Model, Year, Engine volume & HP, Transmission, Fuel Tank Capacity, Drive Type)
Supports Russian, Chinese, European, Japanese, Korean and American vehicles via hybrid ISO-3779 + local knowledge base + NHTSA fallback.
"""
import re
import logging
from typing import Optional, Dict, Any
import httpx
from pydantic import BaseModel

log = logging.getLogger("vin_service")

class VinDecodeResult(BaseModel):
    vin: str
    make: str
    model: str
    year: Optional[int] = None
    engine: Optional[str] = None
    displacement: Optional[str] = None
    horsepower: Optional[int] = None
    transmission: Optional[str] = None
    fuel_tank_capacity: Optional[float] = None
    drive_type: Optional[str] = "fwd"  # fwd, awd, rwd
    fuel_type: Optional[str] = None
    country: Optional[str] = None
    oil_spec: Optional[str] = None
    source: str = "local"


YEAR_MAP: Dict[str, int] = {
    'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014, 'F': 2015,
    'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019, 'L': 2020, 'M': 2021,
    'N': 2022, 'P': 2023, 'R': 2024, 'S': 2025, 'T': 2026, 'V': 2027,
    'W': 2028, 'X': 2029, 'Y': 2030,
    '1': 2001, '2': 2002, '3': 2003, '4': 2004, '5': 2005, '6': 2006,
    '7': 2007, '8': 2008, '9': 2009,
}

WMI_MAP: Dict[str, Dict[str, str]] = {
    # Russian manufacturers & assemblies
    "XTA": {"make": "LADA", "country": "Россия"},
    "XTC": {"make": "КАМАЗ", "country": "Россия"},
    "X7L": {"make": "Renault", "country": "Россия"},
    "Z94": {"make": "Hyundai", "country": "Россия"},
    "XWE": {"make": "Kia", "country": "Россия"},
    "XW8": {"make": "Volkswagen", "country": "Россия"},
    "X4X": {"make": "BMW", "country": "Россия"},
    "XUF": {"make": "Chevrolet", "country": "Россия"},
    "XTT": {"make": "УАЗ", "country": "Россия"},
    "XTH": {"make": "ГАЗ", "country": "Россия"},
    
    # Chinese manufacturers
    "LS5": {"make": "Changan", "country": "Китай"},
    "LS4": {"make": "Changan", "country": "Китай"},
    "LSG": {"make": "SAIC-GM", "country": "Китай"},
    "LB3": {"make": "Geely", "country": "Китай"},
    "LVV": {"make": "Chery", "country": "Китай"},
    "LVP": {"make": "Exeed / Omoda", "country": "Китай"},
    "LGB": {"make": "Haval", "country": "Китай"},
    "CC6": {"make": "Haval", "country": "Китай"},
    "LDC": {"make": "Dongfeng", "country": "Китай"},
    "LFP": {"make": "FAW", "country": "Китай"},
    "LTV": {"make": "BYD", "country": "Китай"},
    "LMG": {"make": "GAC", "country": "Китай"},
    "LFV": {"make": "FAW-Volkswagen", "country": "Китай"},
    "LHG": {"make": "GAC-Honda", "country": "Китай"},
    "LFM": {"make": "FAW-Mazda", "country": "Китай"},
    "LSV": {"make": "SAIC-Volkswagen", "country": "Китай"},

    # German manufacturers
    "WAU": {"make": "Audi", "country": "Германия"},
    "TRU": {"make": "Audi", "country": "Венгрия"},
    "WBA": {"make": "BMW", "country": "Германия"},
    "WBS": {"make": "BMW M", "country": "Германия"},
    "WDB": {"make": "Mercedes-Benz", "country": "Германия"},
    "WDD": {"make": "Mercedes-Benz", "country": "Германия"},
    "WDC": {"make": "Mercedes-Benz", "country": "Германия"},
    "WVW": {"make": "Volkswagen", "country": "Германия"},
    "WV1": {"make": "Volkswagen Коммерческие", "country": "Германия"},
    "WV2": {"make": "Volkswagen Bus", "country": "Германия"},
    "WP0": {"make": "Porsche", "country": "Германия"},
    "WOL": {"make": "Opel", "country": "Германия"},
    
    # Czech / Swedish / French / UK
    "TMB": {"make": "Skoda", "country": "Чехия"},
    "YV1": {"make": "Volvo", "country": "Швеция"},
    "VF1": {"make": "Renault", "country": "Франция"},
    "VF3": {"make": "Peugeot", "country": "Франция"},
    "VF7": {"make": "Citroen", "country": "Франция"},
    "SAL": {"make": "Land Rover", "country": "Великобритания"},
    "SAJ": {"make": "Jaguar", "country": "Великобритания"},

    # Japanese manufacturers
    "JTD": {"make": "Toyota", "country": "Япония"},
    "JTE": {"make": "Toyota", "country": "Япония"},
    "JT1": {"make": "Toyota", "country": "Япония"},
    "JT2": {"make": "Toyota", "country": "Япония"},
    "JT3": {"make": "Toyota", "country": "Япония"},
    "SB1": {"make": "Toyota", "country": "Великобритания"},
    "JHM": {"make": "Honda", "country": "Япония"},
    "JN1": {"make": "Nissan", "country": "Япония"},
    "JN8": {"make": "Nissan", "country": "Япония"},
    "SJN": {"make": "Nissan", "country": "Великобритания"},
    "JMZ": {"make": "Mazda", "country": "Япония"},
    "JMB": {"make": "Mitsubishi", "country": "Япония"},
    "JF1": {"make": "Subaru", "country": "Япония"},
    "JSA": {"make": "Suzuki", "country": "Япония"},

    # Korean manufacturers
    "KMH": {"make": "Hyundai", "country": "Южная Корея"},
    "KM8": {"make": "Hyundai", "country": "Южная Корея"},
    "KNA": {"make": "Kia", "country": "Южная Корея"},
    "KNE": {"make": "Kia", "country": "Южная Корея"},
    "KL1": {"make": "Chevrolet", "country": "Южная Корея"},

    # American manufacturers
    "1HG": {"make": "Honda", "country": "США"},
    "2HG": {"make": "Honda", "country": "Канада"},
    "1FA": {"make": "Ford", "country": "США"},
    "1FB": {"make": "Ford", "country": "США"},
    "1FM": {"make": "Ford", "country": "США"},
    "2FA": {"make": "Ford", "country": "Канада"},
    "4T1": {"make": "Toyota", "country": "США"},
    "5TD": {"make": "Toyota", "country": "США"},
    "5UX": {"make": "BMW", "country": "США"},
    "1G1": {"make": "Chevrolet", "country": "США"},
    "1GC": {"make": "Chevrolet", "country": "США"},
    "2G1": {"make": "Chevrolet", "country": "Канада"},
    "3FA": {"make": "Ford", "country": "Мексика"},
    "3VW": {"make": "Volkswagen", "country": "Мексика"},
}

class VinService:
    @staticmethod
    def clean_vin(vin: str) -> str:
        return re.sub(r'[^A-HJ-NPR-Z0-9]', '', vin.strip().upper())

    @classmethod
    async def decode(cls, raw_vin: str) -> VinDecodeResult:
        vin = cls.clean_vin(raw_vin)
        if len(vin) != 17:
            raise ValueError("VIN номер должен содержать ровно 17 символов")

        # 1. Base ISO year extraction (10th character)
        year_char = vin[9]
        year = YEAR_MAP.get(year_char)

        # 2. Manufacturer & Country via WMI (first 3 chars)
        wmi = vin[:3]
        wmi_info = WMI_MAP.get(wmi)
        if not wmi_info and wmi[:2] in ("XW", "LS", "LB", "LV", "CC"):
            for k, val in WMI_MAP.items():
                if vin.startswith(k):
                    wmi_info = val
                    break

        make = wmi_info["make"] if wmi_info else ""
        country = wmi_info["country"] if wmi_info else ""

        # 3. Model & Technical Specs via rule-based catalog
        res = cls._decode_by_catalog(vin, make, year)
        if res:
            res.country = country or res.country
            return res

        # 4. Fallback to NHTSA vPIC public API (for US/Global models)
        nhtsa_res = await cls._decode_via_nhtsa(vin)
        if nhtsa_res and nhtsa_res.make:
            if not nhtsa_res.country and country:
                nhtsa_res.country = country
            if not nhtsa_res.year and year:
                nhtsa_res.year = year
            return nhtsa_res

        # 5. Fallback minimal result with WMI and Year
        return VinDecodeResult(
            vin=vin,
            make=make or "Автомобиль",
            model="",
            year=year,
            engine="",
            fuel_tank_capacity=55.0,
            drive_type="fwd",
            country=country or "",
            source="wmi",
        )

    @classmethod
    def _decode_by_catalog(cls, vin: str, detected_make: str, year: Optional[int]) -> Optional[VinDecodeResult]:
        """High-precision local knowledge base for Russian, Chinese, European & Asian bestsellers."""
        
        # --- LADA (XTA) ---
        if vin.startswith("XTA"):
            model_code = vin[3:7]
            if model_code.startswith("2190") or model_code.startswith("2191"):
                return VinDecodeResult(
                    vin=vin, make="LADA", model="Granta", year=year,
                    engine="1.6L 106 л.с. (16 кл.)", displacement="1.6L", horsepower=106,
                    transmission="5МКПП", fuel_tank_capacity=50.0, drive_type="fwd",
                    fuel_type="АИ-95", country="Россия", oil_spec="5W-40 / 5W-30 (3.2 л)",
                    source="catalog"
                )
            elif model_code.startswith("GFL") or model_code.startswith("GFK"):
                return VinDecodeResult(
                    vin=vin, make="LADA", model="Vesta", year=year,
                    engine="1.6L 106 л.с. ВАЗ-21129", displacement="1.6L", horsepower=106,
                    transmission="5МКПП / Вариатор", fuel_tank_capacity=55.0, drive_type="fwd",
                    fuel_type="АИ-95", country="Россия", oil_spec="5W-40 / 5W-30 (4.1 л)",
                    source="catalog"
                )
            elif model_code.startswith("GAB"):
                return VinDecodeResult(
                    vin=vin, make="LADA", model="XRAY", year=year,
                    engine="1.6L 106 л.с. / 1.8L 122 л.с.", displacement="1.6L", horsepower=106,
                    transmission="5МКПП", fuel_tank_capacity=50.0, drive_type="fwd",
                    fuel_type="АИ-95", country="Россия", oil_spec="5W-40 (4.1 л)",
                    source="catalog"
                )
            elif model_code.startswith("2121"):
                return VinDecodeResult(
                    vin=vin, make="LADA", model="Niva Legend", year=year,
                    engine="1.7L 83 л.с. ВАЗ-21214", displacement="1.7L", horsepower=83,
                    transmission="5МКПП 4x4", fuel_tank_capacity=42.0, drive_type="awd",
                    fuel_type="АИ-95", country="Россия", oil_spec="5W-40 / 10W-40 (3.75 л)",
                    source="catalog"
                )
            elif model_code.startswith("2123"):
                return VinDecodeResult(
                    vin=vin, make="LADA", model="Niva Travel", year=year,
                    engine="1.7L 80 л.с.", displacement="1.7L", horsepower=80,
                    transmission="5МКПП 4x4", fuel_tank_capacity=58.0, drive_type="awd",
                    fuel_type="АИ-95", country="Россия", oil_spec="5W-40 (3.75 л)",
                    source="catalog"
                )
            elif model_code.startswith("2170"):
                return VinDecodeResult(
                    vin=vin, make="LADA", model="Priora", year=year,
                    engine="1.6L 98 л.с. (16 кл.)", displacement="1.6L", horsepower=98,
                    transmission="5МКПП", fuel_tank_capacity=43.0, drive_type="fwd",
                    fuel_type="АИ-95", country="Россия", oil_spec="5W-40 (3.5 л)",
                    source="catalog"
                )
            elif model_code.startswith("RS0") or model_code.startswith("R90"):
                return VinDecodeResult(
                    vin=vin, make="LADA", model="Largus", year=year,
                    engine="1.6L 90 л.с. / 106 л.с.", displacement="1.6L", horsepower=90,
                    transmission="5МКПП", fuel_tank_capacity=50.0, drive_type="fwd",
                    fuel_type="АИ-95", country="Россия", oil_spec="5W-40 (4.1 л)",
                    source="catalog"
                )

        # --- Changan (LS5, LS4) ---
        if vin.startswith("LS5") or vin.startswith("LS4"):
            model = "CS55 Plus"
            engine = "1.5T 181 л.с. BlueCore Turbo"
            hp = 181
            tank = 55.0
            trans = "7DCT (Робот 7-ст)"
            drive = "fwd"
            oil = "SAE 0W-20 SP / C5 (4.0 - 4.5 л)"

            vds = vin[3:8]
            if "35" in vds or "S1" in vds:
                model = "CS35 Plus"
                engine = "1.4T 150 л.с. / 1.6L 128 л.с."
                hp = 150
                tank = 53.0
            elif "75" in vds or "S3" in vds:
                model = "CS75 Plus"
                engine = "1.5T 178 л.с. / 2.0T 233 л.с."
                hp = 178
                tank = 58.0
                trans = "6АКПП / 8АКПП Aisin"
            elif "UNIV" in vin or "V1" in vds or "UV" in vds:
                model = "UNI-V"
                engine = "1.5T 181 л.с."
                hp = 181
                tank = 51.0
            elif "UNIK" in vin or "K1" in vds or "UK" in vds:
                model = "UNI-K"
                engine = "2.0T 226 л.с."
                hp = 226
                tank = 70.0
                trans = "8АКПП Aisin"
                drive = "awd"
            elif "ALS" in vin or "AL" in vds:
                model = "Alsvin"
                engine = "1.5L 107 л.с."
                hp = 107
                tank = 40.0
                trans = "5DCT"

            return VinDecodeResult(
                vin=vin, make="Changan", model=model, year=year,
                engine=engine, displacement="1.5T", horsepower=hp,
                transmission=trans, fuel_tank_capacity=tank, drive_type=drive,
                fuel_type="АИ-92 / АИ-95", country="Китай", oil_spec=oil,
                source="catalog"
            )

        # --- Haval / Great Wall (LGB, CC6) ---
        if vin.startswith("LGB") or vin.startswith("CC6"):
            model = "Jolion"
            engine = "1.5T 143 л.с. (2WD) / 150 л.с. (4WD)"
            tank = 55.0
            trans = "7DCT"
            drive = "fwd"

            vds = vin[3:8]
            if "F7" in vin or "F7X" in vin:
                model = "F7"
                engine = "1.5T 150 л.с. / 2.0T 190 л.с."
                tank = 56.0
                drive = "awd"
            elif "DARGO" in vin or "B06" in vds:
                model = "Dargo"
                engine = "2.0T 192 л.с."
                tank = 60.0
                drive = "awd"
            elif "H9" in vin or "H9" in vds:
                model = "H9"
                engine = "2.0T 218 л.с. / 2.0D 190 л.с."
                tank = 80.0
                trans = "8АКПП ZF"
                drive = "awd"

            return VinDecodeResult(
                vin=vin, make="Haval", model=model, year=year,
                engine=engine, displacement="1.5T / 2.0T", horsepower=150,
                transmission=trans, fuel_tank_capacity=tank, drive_type=drive,
                fuel_type="АИ-95", country="Китай / Россия", oil_spec="0W-20 / 5W-30 C2/C3",
                source="catalog"
            )

        # --- Geely (LB3) ---
        if vin.startswith("LB3"):
            model = "Coolray"
            engine = "1.5T 150 л.с. Turbo"
            tank = 45.0
            trans = "7DCT"
            drive = "fwd"

            vds = vin[3:8]
            if "MONJARO" in vin or "KX11" in vds:
                model = "Monjaro"
                engine = "2.0T 238 л.с. Drive-E"
                tank = 62.0
                trans = "8АКПП Aisin"
                drive = "awd"
            elif "TUGELLA" in vin or "FY11" in vds:
                model = "Tugella"
                engine = "2.0T 238 л.с. Drive-E"
                tank = 54.0
                trans = "8АКПП Aisin"
                drive = "awd"
            elif "ATLAS" in vin or "NL3" in vds or "FX11" in vds:
                model = "Atlas Pro"
                engine = "1.5T 177 л.с. 48V Mild Hybrid"
                tank = 58.0
                drive = "awd"
            elif "EMGRAND" in vin or "SS11" in vds:
                model = "Emgrand"
                engine = "1.5L 122 л.с."
                tank = 50.0
                trans = "6АКПП / Вариатор"

            return VinDecodeResult(
                vin=vin, make="Geely", model=model, year=year,
                engine=engine, displacement="1.5T / 2.0T", horsepower=150,
                transmission=trans, fuel_tank_capacity=tank, drive_type=drive,
                fuel_type="АИ-95", country="Китай / Беларусь", oil_spec="0W-20 VCC RBS0-2AE",
                source="catalog"
            )

        # --- Chery / Omoda / Jaecoo (LVV, LVP) ---
        if vin.startswith("LVV") or vin.startswith("LVP"):
            model = "Tiggo 7 Pro Max"
            engine = "1.5T 147 л.с. / 1.6T 150 л.с."
            tank = 51.0
            trans = "7DCT / Вариатор (CVT)"
            drive = "fwd"

            vds = vin[3:8]
            if "T4" in vds:
                model = "Tiggo 4 Pro"
                engine = "1.5L 113 л.с. / 1.5T 147 л.с."
                tank = 51.0
            elif "T8" in vds:
                model = "Tiggo 8 Pro Max"
                engine = "2.0T 197 л.с. TGDI"
                tank = 57.0
                drive = "awd"
                trans = "7DCT"
            elif "C5" in vds or "OMODA" in vin:
                model = "Omoda C5"
                engine = "1.5T 147 л.с. (2WD) / 1.6T 150 л.с. (AWD)"
                tank = 52.0
            elif "J7" in vds or "JAECOO" in vin:
                model = "Jaecoo J7"
                engine = "1.6T 186 л.с."
                tank = 57.0
                drive = "awd"
                trans = "7DCT"

            return VinDecodeResult(
                vin=vin, make="Chery", model=model, year=year,
                engine=engine, displacement="1.5T / 1.6T", horsepower=150,
                transmission=trans, fuel_tank_capacity=tank, drive_type=drive,
                fuel_type="АИ-92 / АИ-95", country="Китай", oil_spec="5W-30 / 0W-20 SP",
                source="catalog"
            )

        # --- Hyundai / Kia (Z94 St. Petersburg) ---
        if vin.startswith("Z94"):
            vds = vin[3:8]
            if "CT" in vds or "C" in vds:
                return VinDecodeResult(
                    vin=vin, make="Hyundai", model="Solaris", year=year,
                    engine="1.6L 123 л.с. Gamma D-CVVT", displacement="1.6L", horsepower=123,
                    transmission="6АКПП / 6МКПП", fuel_tank_capacity=50.0, drive_type="fwd",
                    fuel_type="АИ-92 / АИ-95", country="Россия", oil_spec="5W-30 / 5W-20 ILSAC GF-5 (3.6 л)",
                    source="catalog"
                )
            elif "FB" in vds or "GS" in vds:
                return VinDecodeResult(
                    vin=vin, make="Hyundai", model="Creta", year=year,
                    engine="1.6L 123 л.с. / 2.0L 149 л.с. Nu", displacement="1.6L / 2.0L", horsepower=123,
                    transmission="6АКПП / 6МКПП", fuel_tank_capacity=55.0, drive_type="fwd",
                    fuel_type="АИ-92 / АИ-95", country="Россия", oil_spec="5W-30 ILSAC GF-5 (4.0 л)",
                    source="catalog"
                )

        # --- Kia (XWE Avtotor) ---
        if vin.startswith("XWE"):
            vds = vin[3:8]
            if "C" in vds or "F" in vds:
                return VinDecodeResult(
                    vin=vin, make="Kia", model="Rio", year=year,
                    engine="1.6L 123 л.с. Gamma D-CVVT", displacement="1.6L", horsepower=123,
                    transmission="6АКПП / 6МКПП", fuel_tank_capacity=50.0, drive_type="fwd",
                    fuel_type="АИ-92 / АИ-95", country="Россия", oil_spec="5W-30 ILSAC GF-5 (3.6 л)",
                    source="catalog"
                )
            elif "P" in vds or "S" in vds:
                return VinDecodeResult(
                    vin=vin, make="Kia", model="Sportage", year=year,
                    engine="2.0L 150 л.с. MPI Nu", displacement="2.0L", horsepower=150,
                    transmission="6АКПП", fuel_tank_capacity=62.0, drive_type="awd",
                    fuel_type="АИ-95", country="Россия", oil_spec="5W-30 ACEA A5/B5 (4.0 л)",
                    source="catalog"
                )

        # --- Renault (X7L Moscow) ---
        if vin.startswith("X7L"):
            vds = vin[3:8]
            if "SR" in vds or "BS" in vds:
                return VinDecodeResult(
                    vin=vin, make="Renault", model="Logan / Sandero", year=year,
                    engine="1.6L 106 л.с. (K4M) / 1.6L 82 л.с. (K7M)", displacement="1.6L", horsepower=106,
                    transmission="5МКПП / 4АКПП", fuel_tank_capacity=50.0, drive_type="fwd",
                    fuel_type="АИ-95", country="Россия", oil_spec="5W-40 RN0700 (4.8 л)",
                    source="catalog"
                )
            elif "HS" in vds or "H" in vds:
                return VinDecodeResult(
                    vin=vin, make="Renault", model="Duster", year=year,
                    engine="2.0L 143 л.с. (F4R) / 1.3 TCe 150 л.с.", displacement="2.0L", horsepower=143,
                    transmission="6МКПП / Вариатор", fuel_tank_capacity=50.0, drive_type="awd",
                    fuel_type="АИ-95", country="Россия", oil_spec="5W-40 RN0710 (5.4 л)",
                    source="catalog"
                )

        # --- Volkswagen / Skoda (XW8, WVW, TMB) ---
        if vin.startswith("XW8") or vin.startswith("WVW") or vin.startswith("TMB"):
            vds = vin[3:8]
            if "61" in vin or "POLO" in vin or "RAPID" in vin or "NH" in vds:
                make = "Skoda" if vin.startswith("TMB") else "Volkswagen"
                model = "Rapid" if make == "Skoda" else "Polo"
                return VinDecodeResult(
                    vin=vin, make=make, model=model, year=year,
                    engine="1.6 MPI 110 л.с. (CWVA) / 1.4 TSI 125 л.с.", displacement="1.6L", horsepower=110,
                    transmission="6АКПП Aisin / 5МКПП / 7DSG", fuel_tank_capacity=55.0, drive_type="fwd",
                    fuel_type="АИ-95", country="Россия / Германия", oil_spec="5W-40 VW 502.00 (4.0 л)",
                    source="catalog"
                )
            elif "TIGUAN" in vin or "5N" in vds or "AD1" in vds:
                return VinDecodeResult(
                    vin=vin, make="Volkswagen", model="Tiguan", year=year,
                    engine="2.0 TSI 180 л.с. / 1.4 TSI 150 л.с.", displacement="2.0 TSI", horsepower=180,
                    transmission="7DSG (DQ500)", fuel_tank_capacity=58.0, drive_type="awd",
                    fuel_type="АИ-95", country="Германия / Россия", oil_spec="5W-40 VW 502.00 / 0W-20 VW 508.00 (5.7 л)",
                    source="catalog"
                )
            elif "OCTAVIA" in vin or "1Z" in vds or "5E" in vds:
                return VinDecodeResult(
                    vin=vin, make="Skoda", model="Octavia", year=year,
                    engine="1.4 TSI 150 л.с. / 1.6 MPI 110 л.с.", displacement="1.4 TSI", horsepower=150,
                    transmission="8АКПП / 7DSG", fuel_tank_capacity=50.0, drive_type="fwd",
                    fuel_type="АИ-95", country="Чехия / Россия", oil_spec="5W-40 VW 502.00",
                    source="catalog"
                )

        # --- Toyota (JTD, JTE, 4T1, SB1) ---
        if vin.startswith("JTD") or vin.startswith("JTE") or vin.startswith("4T1") or vin.startswith("SB1"):
            vds = vin[3:8]
            if "CAMRY" in vin or "XV" in vds or "V5" in vds or "V7" in vds:
                return VinDecodeResult(
                    vin=vin, make="Toyota", model="Camry", year=year,
                    engine="2.5L 181-200 л.с. / 2.0L 150 л.с.", displacement="2.5L", horsepower=181,
                    transmission="8АКПП / 6АКПП", fuel_tank_capacity=60.0, drive_type="fwd",
                    fuel_type="АИ-95", country="Япония / Россия", oil_spec="0W-20 / 5W-30 (4.4 л)",
                    source="catalog"
                )
            elif "RAV4" in vin or "XA4" in vds or "XA5" in vds:
                return VinDecodeResult(
                    vin=vin, make="Toyota", model="RAV4", year=year,
                    engine="2.0L 149 л.с. / 2.5L 199 л.с. Dynamic Force", displacement="2.0L", horsepower=149,
                    transmission="Вариатор Direct Shift / 8АКПП", fuel_tank_capacity=55.0, drive_type="awd",
                    fuel_type="АИ-95", country="Япония / Россия", oil_spec="0W-20 API SP (4.2 л)",
                    source="catalog"
                )
            elif "PRADO" in vin or "J15" in vds or "LC" in vin:
                return VinDecodeResult(
                    vin=vin, make="Toyota", model="Land Cruiser Prado", year=year,
                    engine="2.8D 200 л.с. Турбодизель / 4.0L 249 л.с.", displacement="2.8D", horsepower=200,
                    transmission="6АКПП", fuel_tank_capacity=87.0, drive_type="awd",
                    fuel_type="ДТ / АИ-95", country="Япония", oil_spec="5W-30 ACEA C2 (7.5 л)",
                    source="catalog"
                )

        return None

    @classmethod
    async def _decode_via_nhtsa(cls, vin: str) -> Optional[VinDecodeResult]:
        """Queries the official US NHTSA vPIC API for American, Japanese, and global models."""
        url = f"https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/{vin}?format=json"
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(url)
                if res.status_code != 200:
                    return None
                data = res.json()
                results = data.get("Results", [])
                if not results:
                    return None
                item = results[0]

                make = (item.get("Make") or "").strip().title()
                model = (item.get("Model") or "").strip()
                if not make or make.lower() in ("null", "none"):
                    return None

                year_str = item.get("ModelYear")
                year = int(year_str) if year_str and year_str.isdigit() else None

                disp = item.get("DisplacementL")
                disp_str = f"{float(disp):.1f}L" if disp and disp.replace('.', '', 1).isdigit() else ""

                hp_str = item.get("EngineHP")
                hp = int(float(hp_str)) if hp_str and hp_str.replace('.', '', 1).isdigit() else None

                # Transmission style
                trans_raw = (item.get("TransmissionStyle") or "").lower()
                if "continuously variable" in trans_raw or "cvt" in trans_raw:
                    trans = "Вариатор (CVT)"
                elif "dual clutch" in trans_raw or "dct" in trans_raw:
                    trans = "Робот (DCT)"
                elif "automatic" in trans_raw or "auto" in trans_raw:
                    trans = "АКПП (Автомат)"
                elif "manual" in trans_raw:
                    trans = "МКПП (Механика)"
                else:
                    trans = item.get("TransmissionStyle") or ""

                # Drive type
                drive_raw = (item.get("DriveType") or "").lower()
                if "all" in drive_raw or "4wd" in drive_raw or "awd" in drive_raw or "4x4" in drive_raw:
                    drive = "awd"
                elif "rear" in drive_raw or "rwd" in drive_raw:
                    drive = "rwd"
                else:
                    drive = "fwd"

                # Fuel type
                fuel_raw = (item.get("FuelTypePrimary") or "").lower()
                if "diesel" in fuel_raw:
                    fuel = "Дизель (ДТ)"
                elif "electric" in fuel_raw:
                    fuel = "Электро"
                elif "gasoline" in fuel_raw or "petrol" in fuel_raw:
                    fuel = "Бензин (АИ-95)"
                else:
                    fuel = item.get("FuelTypePrimary") or "Бензин"

                # Engine description
                engine_parts = []
                if disp_str:
                    engine_parts.append(disp_str)
                if hp:
                    engine_parts.append(f"{hp} л.с.")
                if fuel and fuel != "Бензин":
                    engine_parts.append(fuel)
                if trans:
                    engine_parts.append(f"({trans})")
                engine_desc = " ".join(engine_parts)

                # Fuel tank capacity heuristic
                body_class = (item.get("BodyClass") or "").lower()
                tank = 55.0
                if "suv" in body_class or "crossover" in body_class:
                    tank = 60.0 if (hp and hp > 200) else 55.0
                elif "truck" in body_class or "pickup" in body_class:
                    tank = 85.0
                elif "sedan" in body_class or "hatchback" in body_class:
                    tank = 50.0
                elif "van" in body_class or "minivan" in body_class:
                    tank = 68.0

                country = item.get("PlantCountry") or ""
                if "united states" in country.lower():
                    country = "США"
                elif "japan" in country.lower():
                    country = "Япония"
                elif "germany" in country.lower():
                    country = "Германия"
                elif "korea" in country.lower():
                    country = "Южная Корея"

                return VinDecodeResult(
                    vin=vin,
                    make=make,
                    model=model,
                    year=year,
                    engine=engine_desc,
                    displacement=disp_str,
                    horsepower=hp,
                    transmission=trans,
                    fuel_tank_capacity=tank,
                    drive_type=drive,
                    fuel_type=fuel,
                    country=country,
                    source="nhtsa",
                )
        except Exception as e:
            log.warning(f"NHTSA VIN decode error: {e}")
            return None
