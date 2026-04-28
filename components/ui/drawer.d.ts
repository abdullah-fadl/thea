import * as React from 'react';

export interface DrawerProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  shouldScaleBackground?: boolean;
  children?: React.ReactNode;
}

export interface DrawerContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

export interface DrawerHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

export interface DrawerFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

export interface DrawerTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children?: React.ReactNode;
  className?: string;
}

export interface DrawerDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  children?: React.ReactNode;
  className?: string;
}

export declare const Drawer: React.FC<DrawerProps>;
export declare const DrawerContent: React.ForwardRefExoticComponent<DrawerContentProps & React.RefAttributes<HTMLDivElement>>;
export declare const DrawerHeader: React.ForwardRefExoticComponent<DrawerHeaderProps & React.RefAttributes<HTMLDivElement>>;
export declare const DrawerFooter: React.ForwardRefExoticComponent<DrawerFooterProps & React.RefAttributes<HTMLDivElement>>;
export declare const DrawerTitle: React.ForwardRefExoticComponent<DrawerTitleProps & React.RefAttributes<HTMLHeadingElement>>;
export declare const DrawerDescription: React.ForwardRefExoticComponent<DrawerDescriptionProps & React.RefAttributes<HTMLParagraphElement>>;
export declare const DrawerTrigger: React.FC<any>;
export declare const DrawerClose: React.FC<any>;
export declare const DrawerPortal: React.FC<any>;
export declare const DrawerOverlay: React.ForwardRefExoticComponent<any>;

