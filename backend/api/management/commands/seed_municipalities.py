from django.core.management.base import BaseCommand
from api.models import Municipality, Barangay

class Command(BaseCommand):
    help = 'Seeds La Union municipalities and barangays'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding municipalities and barangays...')
        
        # Municipality data with colors and barangays
        municipalities_data = {
            'Agoo': {
                'color': '#FF6B6B',
                'barangays': [
                    "Ambitacay", "Balawarte", "Capas", "Consolacion", "Macalva Central",
                    "Macalva Norte", "Macalva Sur", "Nazareno", "Purok", "San Agustin East",
                    "San Agustin Norte", "San Agustin Sur", "San Antonino", "San Antonio",
                    "San Francisco", "San Isidro", "San Joaquin Norte", "San Joaquin Sur",
                    "San Jose Norte", "San Jose Sur", "San Juan", "San Julian Central",
                    "San Julian East", "San Julian Norte", "San Julian West", "San Manuel Norte",
                    "San Manuel Sur", "San Marcos", "San Miguel", "San Nicolas Central",
                    "San Nicolas East", "San Nicolas Norte", "San Nicolas Sur", "San Nicolas West",
                    "San Pedro", "San Roque West", "San Roque East", "San Vicente Norte",
                    "San Vicente Sur", "Santa Ana", "Santa Barbara", "Santa Fe", "Santa Maria",
                    "Santa Monica", "Santa Rita (Nalinac)", "Santa Rita East", "Santa Rita Norte",
                    "Santa Rita Sur", "Santa Rita West"
                ]
            },
            'Aringay': {
                'color': '#4ECDC4',
                'barangays': [
                    "Alaska", "Basca", "Dulao", "Gallano", "Macabato", "Manga",
                    "Pangao-aoan East", "Pangao-aoan West", "Poblacion", "Samara",
                    "San Antonio", "San Benito Norte", "San Benito Sur", "San Eugenio",
                    "San Juan East", "San Juan West", "San Simon East", "San Simon West",
                    "Santa Cecilia", "Santa Lucia", "Santa Rita East", "Santa Rita West",
                    "Santo Rosario East", "Santo Rosario West"
                ]
            },
            'Bacnotan': {
                'color': '#95E1D3',
                'barangays': [
                    "Agtipal", "Arosip", "Bacqui", "Bacsil", "Bagutot", "Ballogo",
                    "Baroro", "Bitalag", "Bulala", "Burayoc", "Bussaoit", "Cabaroan",
                    "Cabarsican", "Cabugao", "Calautit", "Carcarmay", "Casiaman",
                    "Galongen", "Guinabang", "Legleg", "Lisqueb", "Mabanengbeng 1st",
                    "Mabanengbeng 2nd", "Maragayap", "Nangalisan", "Nagatiran",
                    "Nagsaraboan", "Nagsimbaanan", "Narra", "Ortega", "Paagan",
                    "Pandan", "Pang-pang", "Poblacion", "Quirino", "Raois", "Salincob",
                    "San Martin", "Santa Cruz", "Santa Rita", "Sapilang", "Sayoan",
                    "Sipulo", "Tammocalao", "Ubbog", "Oya-oy", "Zaragosa"
                ]
            },
            'Bagulin': {
                'color': '#F38181',
                'barangays': [
                    "Alibangsay", "Baay", "Cambaly", "Cardiz", "Dagup",
                    "Libbo", "Suyo", "Tagudtud", "Tio-angan", "Wallayan"
                ]
            },
            'Balaoan': {
                'color': '#AA96DA',
                'barangays': [
                    "Almieda", "Antonino", "Apatut", "Ar-arampang", "Baracbac Este",
                    "Baracbac Oeste", "Bet-ang", "Bulbulala", "Bungol", "Butubut Este",
                    "Butubut Norte", "Butubut Oeste", "Butubut Sur", "Cabuaan Oeste",
                    "Calliat", "Calungbuyan", "Camiling", "Dr. Camilo Osias",
                    "Guinaburan", "Masupe", "Nagsabaran Norte", "Nagsabaran Sur",
                    "Nalasin", "Napaset", "Pagbennecan", "Pagleddegan", "Pantar Norte",
                    "Pantar Sur", "Pa-o", "Paraoir", "Patpata", "Sablut", "San Pablo",
                    "Sinapangan Norte", "Sinapangan Sur", "Tallipugo"
                ]
            },
            'Bangar': {
                'color': '#FCBAD3',
                'barangays': [
                    "Agdeppa", "Alzate", "Bangaoilan East", "Bangaoilan West",
                    "Barraca", "Cadapli", "Caggao", "Consuegra", "General Prim East",
                    "General Prim West", "General Terrero", "Luzong Norte", "Luzong Sur",
                    "Maria Cristina East", "Maria Cristina West", "Mindoro",
                    "Nagsabaran", "Paratong Norte", "Paratong No. 3", "Paratong No. 4",
                    "Central East No. 1", "Central East No. 2", "Central West No. 1",
                    "Central West No. 2", "Central West No. 3", "Quintarong",
                    "Reyna Regente", "Rissing", "San Blas", "San Cristobal",
                    "Sinapangan Norte", "Sinapangan Sur", "Ubbog"
                ]
            },
            'Bauang': {
                'color': '#FFFFD2',
                'barangays': [
                    "Acao", "Baccuit Norte", "Baccuit Sur", "Bagbag", "Ballay",
                    "Bawanta", "Boy-utan", "Bucayab", "Cabalayangan", "Cabisilan",
                    "Calumbaya", "Carmay", "Casilagan", "Central East", "Central West",
                    "Dili", "Disso-or", "Guerrero", "Nagrebcan", "Pagdalagan Sur",
                    "Palintucang", "Palugsi-Limmansangan", "Parian Oeste", "Parian Este",
                    "Paringao", "Payocpoc Norte Este", "Payocpoc Norte Oeste",
                    "Payocpoc Sur", "Pilar", "Pudoc", "Pottot", "Pugo", "Quinavite",
                    "Lower San Agustin", "Santa Monica", "Santiago", "Taberna",
                    "Upper San Agustin", "Urayong"
                ]
            },
            'Burgos': {
                'color': '#A8E6CF',
                'barangays': [
                    "Agpay", "Bilis", "Caoayan", "Dalacdac", "Delles", "Imelda",
                    "Libtong", "Linuan", "New Poblacion", "Old Poblacion",
                    "Lower Tumapoc", "Upper Tumapoc"
                ]
            },
            'Caba': {
                'color': '#FFD3B6',
                'barangays': [
                    "Bautista", "Gana", "Juan Cartas", "Las-ud", "Liquicia",
                    "Poblacion Norte", "Poblacion Sur", "San Carlos", "San Cornelio",
                    "San Fermin", "San Gregorio", "San Jose", "Santiago Norte",
                    "Santiago Sur", "Sobredillo", "Urayong", "Wenceslao"
                ]
            },
            'San Fernando': {
                'color': '#3B82F6',
                'barangays': [
                    "Abut", "Apaleng", "Bacsil", "Bangbangolan", "Bangcusay",
                    "Barangay I", "Barangay II", "Barangay III", "Barangay IV",
                    "Baraoas", "Bato", "Biday", "Birunget", "Bungro", "Cabaroan",
                    "Cabarsican", "Cadaclan", "Calabugao", "Camansi", "Canaoay",
                    "Carlatan", "Catbangen", "Dallangayan Este", "Dallangayan Oeste",
                    "Dalumpinas Este", "Dalumpinas Oeste", "Ilocanos Norte",
                    "Ilocanos Sur", "Langcuas", "Lingsat", "Madayegdeg", "Mameltac",
                    "Masicong", "Nagyubuyuban", "Namtutan", "Narra Este", "Narra Oeste",
                    "Pacpaco", "Pagdalagan", "Pagdaraoan", "Pagudpud", "Pao Norte",
                    "Pao Sur", "Parian", "Pias", "Poro", "Puspus", "Sacyud", "Sagayad",
                    "San Agustin", "San Francisco", "San Vicente", "Santiago Norte",
                    "Santiago Sur", "Saoay", "Sevilla", "Siboan-Otong", "Tanqui",
                    "Tanquigan"
                ]
            },
            'Luna': {
                'color': '#DDA15E',
                'barangays': [
                    "Alcala", "Ayaoan", "Barangobong", "Barrientos", "Bungro",
                    "Buselbusel", "Cabalitocan", "Cantoria No. 1", "Cantoria No. 2",
                    "Cantoria No. 3", "Cantoria No. 4", "Carisquis", "Darigayos",
                    "Magallanes", "Magsiping", "Mamay", "Nagrebcan", "Nalvo Norte",
                    "Nalvo Sur", "Napaset", "Oaqui No. 1", "Oaqui No. 2", "Oaqui No. 3",
                    "Oaqui No. 4", "Pila", "Pitpitac", "Rimos No. 1", "Rimos No. 2",
                    "Rimos No. 3", "Rimos No. 4", "Rimos No. 5", "Rissing", "Salcedo",
                    "Santo Domingo Norte", "Santo Domingo Sur", "Sucoc Norte",
                    "Sucoc Sur", "Suyo", "Tallaoen", "Victoria"
                ]
            },
            'Naguilian': {
                'color': '#BC6C25',
                'barangays': [
                    "Aguioas", "Al-alinao Norte", "Al-alinao Sur", "Ambaracao Norte",
                    "Ambaracao Sur", "Angin", "Balecbec", "Bancagan", "Baraoas Norte",
                    "Baraoas Sur", "Bariquir", "Bato", "Bimmotobot", "Cabaritan Norte",
                    "Cabaritan Sur", "Casilagan", "Dal-lipaoen", "Daramuangan",
                    "Guesset", "Gusing Norte", "Gusing Sur", "Imelda", "Lioac Norte",
                    "Lioac Sur", "Mangungunay", "Mamat-ing Norte", "Mamat-ing Sur",
                    "Nagsidorisan", "Natividad", "Ortiz", "Ribsuan", "San Antonio",
                    "San Isidro", "Sili", "Saguidan Norte", "Saguidan Sur", "Tuddingan"
                ]
            },
            'Pugo': {
                'color': '#606C38',
                'barangays': [
                    "Ambalite", "Ambangonan", "Cares", "Cuenca", "Duplas",
                    "Maoasoas Norte", "Maoasoas Sur", "Palina", "Poblacion East",
                    "Poblacion West", "San Luis", "Saytan", "Tavora East", "Tavora Proper"
                ]
            },
            'Rosario': {
                'color': '#283618',
                'barangays': [
                    "Alipang", "Ambangonan", "Amlang", "Bacani", "Bangar", "Bani",
                    "Benteng-Sapilang", "Cadumanian", "Camp One", "Carunuan East",
                    "Carunuan West", "Casilagan", "Cataguingtingan", "Concepcion",
                    "Damortis", "Gumot-Nagcolaran", "Inabaan Norte", "Inabaan Sur",
                    "Nagtagaan", "Nangcamotian", "Parasapas", "Poblacion East",
                    "Poblacion West", "Puzon", "Rabon", "San Jose", "Marcos",
                    "Subusub", "Tabtabungao", "Tanglag", "Tay-ac", "Udiao", "Vila"
                ]
            },
            'San Gabriel': {
                'color': '#FEFAE0',
                'barangays': [
                    "Amontoc", "Apayao", "Balbalayang", "Bayabas", "Bucao",
                    "Bumbuneg", "Lacong", "Lipay Este", "Lipay Norte", "Lipay Proper",
                    "Lipay Sur", "Lon-oy", "Poblacion", "Polipol", "Daking"
                ]
            },
            'San Juan': {
                'color': '#E9EDC9',
                'barangays': [
                    "Allangigan", "Aludaid", "Bacsayan", "Balballosa", "Bambanay",
                    "Bugbugcao", "Caarusipan", "Cabaroan", "Cabugnayan", "Cacapian",
                    "Caculangan", "Calincamasan", "Casilagan", "Catdongan",
                    "Dangdangla", "Dasay", "Dinanum", "Duplas", "Guinguinabang",
                    "Ili Norte", "Ili Sur", "Legleg", "Lubing", "Nadsaag",
                    "Nagsabaran", "Naguirangan", "Naguituban", "Nagyubuyuban",
                    "Oaquing", "Pacpacac", "Pagdildilan", "Panicsican", "Quidem",
                    "San Felipe", "Santa Rosa", "Santo Rosario", "Saracat",
                    "Sinapangan", "Taboc", "Talogtog", "Urbiztondo"
                ]
            },
            'Santo Tomas': {
                'color': '#CCD5AE',
                'barangays': [
                    "Ambitacay", "Bail", "Balaoc", "Balsaan", "Baybay", "Cabaruan",
                    "Casantaan", "Casilagan", "Cupang", "Damortis", "Fernando",
                    "Linong", "Lomboy", "Malabago", "Namboongan", "Namonitan",
                    "Narvacan", "Patac", "Poblacion", "Pongpong", "Raois", "Tubod",
                    "Tococ", "Ubagan"
                ]
            },
            'Santol': {
                'color': '#D4A373',
                'barangays': [
                    "Corrooy", "Lettac Norte", "Lettac Sur", "Mangaan", "Paagan",
                    "Poblacion", "Puguil", "Ramot", "Sapdaan", "Sasaba", "Tubaday"
                ]
            },
            'Sudipen': {
                'color': '#FAEDCD',
                'barangays': [
                    "Bigbiga", "Bulalaan", "Castro", "Duplas", "Ilocano", "Ipet",
                    "Maliclico", "Namaltugan", "Old Central", "Poblacion",
                    "Porporiket", "San Francisco Norte", "San Francisco Sur",
                    "San Jose", "Sengngat", "Turod", "Up-uplas"
                ]
            },
            'Tubao': {
                'color': '#E07A5F',
                'barangays': [
                    "Amallapay", "Anduyan", "Caoigue", "Francia Sur", "Francia West",
                    "Garcia", "Gonzales", "Halog East", "Halog West", "Leones East",
                    "Leones West", "Linapew", "Magsaysay", "Pideg", "Poblacion",
                    "Rizal", "Santa Teresa", "Lloren"
                ]
            }
        }

        created_municipalities = 0
        created_barangays = 0

        for muni_name, muni_data in municipalities_data.items():
            # Create or get municipality
            municipality, created = Municipality.objects.get_or_create(
                name=muni_name,
                defaults={'color': muni_data['color'], 'is_active': True}
            )
            
            if created:
                created_municipalities += 1
                self.stdout.write(self.style.SUCCESS(f'Created municipality: {muni_name}'))
            else:
                self.stdout.write(f'Municipality already exists: {muni_name}')
            
            # Create barangays
            for barangay_name in muni_data['barangays']:
                barangay, created = Barangay.objects.get_or_create(
                    name=barangay_name,
                    municipality=municipality
                )
                
                if created:
                    created_barangays += 1

        self.stdout.write(self.style.SUCCESS(
            f'\nSeeding complete!'
            f'\nMunicipalities created: {created_municipalities}'
            f'\nBarangays created: {created_barangays}'
        ))
