'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLang } from '@/hooks/use-lang';

interface Group {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

interface Hospital {
  id: string;
  name: string;
  code: string;
  groupId: string;
  isActive: boolean;
}

export default function GroupsHospitals() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isHospitalDialogOpen, setIsHospitalDialogOpen] = useState(false);
  const [isEditGroupDialogOpen, setIsEditGroupDialogOpen] = useState(false);
  const [isEditHospitalDialogOpen, setIsEditHospitalDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editingHospital, setEditingHospital] = useState<Hospital | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { language } = useLang();
  const tr = (ar: string, en: string) => language === 'ar' ? ar : en;

  const [groupFormData, setGroupFormData] = useState({
    name: '',
    code: '',
  });

  const [hospitalFormData, setHospitalFormData] = useState({
    name: '',
    code: '',
    groupId: '',
  });

  useEffect(() => {
    fetchGroups();
    fetchHospitals();
  }, []);

  async function fetchGroups() {
    try {
      const response = await fetch('/api/admin/groups', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  }

  async function fetchHospitals() {
    try {
      const response = await fetch('/api/admin/hospitals', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setHospitals(data.hospitals || []);
      }
    } catch (error) {
      console.error('Failed to fetch hospitals:', error);
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/groups', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupFormData),
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم إنشاء المجموعة بنجاح' : 'Group created successfully',
        });
        setIsGroupDialogOpen(false);
        setGroupFormData({ name: '', code: '' });
        await fetchGroups();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create group');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to create group',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!editingGroup) return;

    setIsLoading(true);

    try {
      const response = await fetch(`/api/admin/groups/${editingGroup.id}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupFormData),
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم تحديث المجموعة بنجاح' : 'Group updated successfully',
        });
        setIsEditGroupDialogOpen(false);
        setEditingGroup(null);
        setGroupFormData({ name: '', code: '' });
        await fetchGroups();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update group');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to update group',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذه المجموعة؟' : 'Are you sure you want to delete this group?')) return;

    try {
      const response = await fetch(`/api/admin/groups/${groupId}`, {
        credentials: 'include',
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم حذف المجموعة بنجاح' : 'Group deleted successfully',
        });
        await fetchGroups();
        await fetchHospitals(); // Refresh hospitals in case they were deleted
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete group');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete group',
        variant: 'destructive',
      });
    }
  }

  function handleEditGroup(group: Group) {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      code: group.code,
    });
    setIsEditGroupDialogOpen(true);
  }

  async function handleCreateHospital(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/hospitals', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hospitalFormData),
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم إنشاء المستشفى بنجاح' : 'Hospital created successfully',
        });
        setIsHospitalDialogOpen(false);
        setHospitalFormData({ name: '', code: '', groupId: '' });
        await fetchHospitals();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create hospital');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to create hospital',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdateHospital(e: React.FormEvent) {
    e.preventDefault();
    if (!editingHospital) return;

    setIsLoading(true);

    try {
      const response = await fetch(`/api/admin/hospitals/${editingHospital.id}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hospitalFormData),
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم تحديث المستشفى بنجاح' : 'Hospital updated successfully',
        });
        setIsEditHospitalDialogOpen(false);
        setEditingHospital(null);
        setHospitalFormData({ name: '', code: '', groupId: '' });
        await fetchHospitals();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update hospital');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to update hospital',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteHospital(hospitalId: string) {
    if (!confirm(language === 'ar' ? 'هل أنت متأكد من حذف هذا المستشفى؟' : 'Are you sure you want to delete this hospital?')) return;

    try {
      const response = await fetch(`/api/admin/hospitals/${hospitalId}`, {
        credentials: 'include',
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: language === 'ar' ? 'نجح' : 'Success',
          description: language === 'ar' ? 'تم حذف المستشفى بنجاح' : 'Hospital deleted successfully',
        });
        await fetchHospitals();
      } else {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete hospital');
      }
    } catch (error) {
      toast({
        title: language === 'ar' ? 'خطأ' : 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete hospital',
        variant: 'destructive',
      });
    }
  }

  function handleEditHospital(hospital: Hospital) {
    setEditingHospital(hospital);
    setHospitalFormData({
      name: hospital.name,
      code: hospital.code,
      groupId: hospital.groupId,
    });
    setIsEditHospitalDialogOpen(true);
  }

  function getGroupName(groupId: string): string {
    const group = groups.find(g => g.id === groupId);
    return group ? group.name : groupId;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          {language === 'ar' ? 'إدارة المجموعات والمستشفيات' : 'Groups & Hospitals Management'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {language === 'ar' ? 'إضافة وتعديل وحذف المجموعات والمستشفيات' : 'Add, edit, and delete groups and hospitals'}
        </p>
      </div>

      <Tabs defaultValue="groups" className="space-y-4">
        <TabsList>
          <TabsTrigger value="groups">
            {language === 'ar' ? 'المجموعات' : 'Groups'}
          </TabsTrigger>
          <TabsTrigger value="hospitals">
            {language === 'ar' ? 'المستشفيات' : 'Hospitals'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="groups" className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{language === 'ar' ? 'المجموعات' : 'Groups'}</h2>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'إدارة جميع المجموعات' : 'Manage all groups'}
                </p>
              </div>
              <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl">
                    <Plus className="mr-2 h-4 w-4" />
                    {language === 'ar' ? 'إضافة مجموعة' : 'Add Group'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>{language === 'ar' ? 'إضافة مجموعة جديدة' : 'Create New Group'}</DialogTitle>
                    <DialogDescription>
                      {language === 'ar' ? 'أدخل معلومات المجموعة' : 'Enter group information'}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateGroup} className="space-y-4">
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'اسم المجموعة' : 'Group Name'}</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={groupFormData.name}
                        onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'رمز المجموعة' : 'Group Code'}</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={groupFormData.code}
                        onChange={(e) => setGroupFormData({ ...groupFormData, code: e.target.value })}
                        required
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsGroupDialogOpen(false)}>
                        {tr('إلغاء', 'Cancel')}
                      </Button>
                      <Button type="submit" className="rounded-xl" disabled={isLoading}>
                        {isLoading ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...') : (language === 'ar' ? 'إنشاء' : 'Create')}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-4 gap-4 px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'الاسم' : 'Name'}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'الرمز' : 'Code'}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'الحالة' : 'Status'}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">{language === 'ar' ? 'الإجراءات' : 'Actions'}</span>
            </div>

            {/* Table rows */}
            {groups.length === 0 ? (
              <div className="px-4 py-6 text-center text-muted-foreground">
                {language === 'ar' ? 'لا توجد مجموعات' : 'No groups found'}
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.id} className="grid grid-cols-4 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                  <span className="font-medium text-foreground">{group.name}</span>
                  <span className="text-foreground">{group.code}</span>
                  <span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        group.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {group.isActive ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                    </span>
                  </span>
                  <span className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => handleEditGroup(group)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => handleDeleteGroup(group.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </span>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="hospitals" className="space-y-4">
          <div className="rounded-2xl bg-card border border-border p-6 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{language === 'ar' ? 'المستشفيات' : 'Hospitals'}</h2>
                <p className="text-sm text-muted-foreground">
                  {language === 'ar' ? 'إدارة جميع المستشفيات' : 'Manage all hospitals'}
                </p>
              </div>
              <Dialog open={isHospitalDialogOpen} onOpenChange={setIsHospitalDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-xl">
                    <Plus className="mr-2 h-4 w-4" />
                    {language === 'ar' ? 'إضافة مستشفى' : 'Add Hospital'}
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>{language === 'ar' ? 'إضافة مستشفى جديد' : 'Create New Hospital'}</DialogTitle>
                    <DialogDescription>
                      {language === 'ar' ? 'أدخل معلومات المستشفى' : 'Enter hospital information'}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateHospital} className="space-y-4">
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'المجموعة' : 'Group'}</span>
                      <Select
                        value={hospitalFormData.groupId}
                        onValueChange={(value) => setHospitalFormData({ ...hospitalFormData, groupId: value })}
                        required
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder={language === 'ar' ? 'اختر مجموعة' : 'Select group'} />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name} ({group.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'اسم المستشفى' : 'Hospital Name'}</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={hospitalFormData.name}
                        onChange={(e) => setHospitalFormData({ ...hospitalFormData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'رمز المستشفى' : 'Hospital Code'}</span>
                      <Input
                        className="rounded-xl thea-input-focus"
                        value={hospitalFormData.code}
                        onChange={(e) => setHospitalFormData({ ...hospitalFormData, code: e.target.value })}
                        required
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" className="rounded-xl" onClick={() => setIsHospitalDialogOpen(false)}>
                        {tr('إلغاء', 'Cancel')}
                      </Button>
                      <Button type="submit" className="rounded-xl" disabled={isLoading}>
                        {isLoading ? (language === 'ar' ? 'جاري الإنشاء...' : 'Creating...') : (language === 'ar' ? 'إنشاء' : 'Create')}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Table header */}
            <div className="grid grid-cols-5 gap-4 px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'الاسم' : 'Name'}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'الرمز' : 'Code'}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'المجموعة' : 'Group'}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'الحالة' : 'Status'}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">{language === 'ar' ? 'الإجراءات' : 'Actions'}</span>
            </div>

            {/* Table rows */}
            {hospitals.length === 0 ? (
              <div className="px-4 py-6 text-center text-muted-foreground">
                {language === 'ar' ? 'لا توجد مستشفيات' : 'No hospitals found'}
              </div>
            ) : (
              hospitals.map((hospital) => (
                <div key={hospital.id} className="grid grid-cols-5 gap-4 px-4 py-3 rounded-xl thea-hover-lift thea-transition-fast">
                  <span className="font-medium text-foreground">{hospital.name}</span>
                  <span className="text-foreground">{hospital.code}</span>
                  <span className="text-foreground">{getGroupName(hospital.groupId)}</span>
                  <span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        hospital.isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500'
                          : 'bg-muted text-foreground'
                      }`}
                    >
                      {hospital.isActive ? (language === 'ar' ? 'نشط' : 'Active') : (language === 'ar' ? 'غير نشط' : 'Inactive')}
                    </span>
                  </span>
                  <span className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => handleEditHospital(hospital)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => handleDeleteHospital(hospital.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </span>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Group Dialog */}
      <Dialog open={isEditGroupDialogOpen} onOpenChange={setIsEditGroupDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تعديل المجموعة' : 'Edit Group'}</DialogTitle>
            <DialogDescription>
              {language === 'ar' ? 'قم بتحديث معلومات المجموعة' : 'Update group information'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateGroup} className="space-y-4">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'اسم المجموعة' : 'Group Name'}</span>
              <Input
                className="rounded-xl thea-input-focus"
                value={groupFormData.name}
                onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'رمز المجموعة' : 'Group Code'}</span>
              <Input
                className="rounded-xl thea-input-focus"
                value={groupFormData.code}
                onChange={(e) => setGroupFormData({ ...groupFormData, code: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => {
                setIsEditGroupDialogOpen(false);
                setEditingGroup(null);
              }}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button type="submit" className="rounded-xl" disabled={isLoading}>
                {isLoading ? (language === 'ar' ? 'جاري التحديث...' : 'Updating...') : (language === 'ar' ? 'تحديث' : 'Update')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Hospital Dialog */}
      <Dialog open={isEditHospitalDialogOpen} onOpenChange={setIsEditHospitalDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{language === 'ar' ? 'تعديل المستشفى' : 'Edit Hospital'}</DialogTitle>
            <DialogDescription>
              {language === 'ar' ? 'قم بتحديث معلومات المستشفى' : 'Update hospital information'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateHospital} className="space-y-4">
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'المجموعة' : 'Group'}</span>
              <Select
                value={hospitalFormData.groupId}
                onValueChange={(value) => setHospitalFormData({ ...hospitalFormData, groupId: value })}
                required
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={language === 'ar' ? 'اختر مجموعة' : 'Select group'} />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'اسم المستشفى' : 'Hospital Name'}</span>
              <Input
                className="rounded-xl thea-input-focus"
                value={hospitalFormData.name}
                onChange={(e) => setHospitalFormData({ ...hospitalFormData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{language === 'ar' ? 'رمز المستشفى' : 'Hospital Code'}</span>
              <Input
                className="rounded-xl thea-input-focus"
                value={hospitalFormData.code}
                onChange={(e) => setHospitalFormData({ ...hospitalFormData, code: e.target.value })}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-xl" onClick={() => {
                setIsEditHospitalDialogOpen(false);
                setEditingHospital(null);
              }}>
                {tr('إلغاء', 'Cancel')}
              </Button>
              <Button type="submit" className="rounded-xl" disabled={isLoading}>
                {isLoading ? (language === 'ar' ? 'جاري التحديث...' : 'Updating...') : (language === 'ar' ? 'تحديث' : 'Update')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
