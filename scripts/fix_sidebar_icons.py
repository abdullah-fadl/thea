path='/Users/yousef/Desktop/backup/Thea2/components/Sidebar.tsx'
with open(path) as fh:
    c=fh.read()
old="  BarChart2,\n} from 'lucide-react';"
new="  BarChart2,\n  Target,\n  TrendingUp,\n} from 'lucide-react';"
if old in c:
    c=c.replace(old,new)
    print('icons inserted')
else:
    print('anchor not found, trying BarChart2 with Video prefix...')
with open(path,'w') as fh:
    fh.write(c)
print('has Target:', 'Target,' in c)
print('done')
