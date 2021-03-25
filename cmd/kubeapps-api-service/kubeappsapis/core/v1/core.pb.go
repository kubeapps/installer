// Code generated by protoc-gen-go. DO NOT EDIT.
// versions:
// 	protoc-gen-go v1.25.0-devel
// 	protoc        v3.15.2
// source: kubeappsapis/core/v1/core.proto

package v1

import (
	_ "google.golang.org/genproto/googleapis/api/annotations"
	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
	protoimpl "google.golang.org/protobuf/runtime/protoimpl"
	reflect "reflect"
	sync "sync"
)

const (
	// Verify that this generated code is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(20 - protoimpl.MinVersion)
	// Verify that runtime/protoimpl is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
)

// The Core API service provides generic functionality shared across all
// plugins, such as querying for enabled plugins (which can be used as a
// liveness check). There may be other general functionality for use by all
// plugins in the future such as creating credentials.
type PluginsAvailableRequest struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields
}

func (x *PluginsAvailableRequest) Reset() {
	*x = PluginsAvailableRequest{}
	if protoimpl.UnsafeEnabled {
		mi := &file_kubeappsapis_core_v1_core_proto_msgTypes[0]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *PluginsAvailableRequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*PluginsAvailableRequest) ProtoMessage() {}

func (x *PluginsAvailableRequest) ProtoReflect() protoreflect.Message {
	mi := &file_kubeappsapis_core_v1_core_proto_msgTypes[0]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use PluginsAvailableRequest.ProtoReflect.Descriptor instead.
func (*PluginsAvailableRequest) Descriptor() ([]byte, []int) {
	return file_kubeappsapis_core_v1_core_proto_rawDescGZIP(), []int{0}
}

type PluginsAvailableResponse struct {
	state         protoimpl.MessageState
	sizeCache     protoimpl.SizeCache
	unknownFields protoimpl.UnknownFields

	Plugins []string `protobuf:"bytes,1,rep,name=plugins,proto3" json:"plugins,omitempty"`
}

func (x *PluginsAvailableResponse) Reset() {
	*x = PluginsAvailableResponse{}
	if protoimpl.UnsafeEnabled {
		mi := &file_kubeappsapis_core_v1_core_proto_msgTypes[1]
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		ms.StoreMessageInfo(mi)
	}
}

func (x *PluginsAvailableResponse) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*PluginsAvailableResponse) ProtoMessage() {}

func (x *PluginsAvailableResponse) ProtoReflect() protoreflect.Message {
	mi := &file_kubeappsapis_core_v1_core_proto_msgTypes[1]
	if protoimpl.UnsafeEnabled && x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use PluginsAvailableResponse.ProtoReflect.Descriptor instead.
func (*PluginsAvailableResponse) Descriptor() ([]byte, []int) {
	return file_kubeappsapis_core_v1_core_proto_rawDescGZIP(), []int{1}
}

func (x *PluginsAvailableResponse) GetPlugins() []string {
	if x != nil {
		return x.Plugins
	}
	return nil
}

var File_kubeappsapis_core_v1_core_proto protoreflect.FileDescriptor

var file_kubeappsapis_core_v1_core_proto_rawDesc = []byte{
	0x0a, 0x1f, 0x6b, 0x75, 0x62, 0x65, 0x61, 0x70, 0x70, 0x73, 0x61, 0x70, 0x69, 0x73, 0x2f, 0x63,
	0x6f, 0x72, 0x65, 0x2f, 0x76, 0x31, 0x2f, 0x63, 0x6f, 0x72, 0x65, 0x2e, 0x70, 0x72, 0x6f, 0x74,
	0x6f, 0x12, 0x14, 0x6b, 0x75, 0x62, 0x65, 0x61, 0x70, 0x70, 0x73, 0x61, 0x70, 0x69, 0x73, 0x2e,
	0x63, 0x6f, 0x72, 0x65, 0x2e, 0x76, 0x31, 0x1a, 0x1c, 0x67, 0x6f, 0x6f, 0x67, 0x6c, 0x65, 0x2f,
	0x61, 0x70, 0x69, 0x2f, 0x61, 0x6e, 0x6e, 0x6f, 0x74, 0x61, 0x74, 0x69, 0x6f, 0x6e, 0x73, 0x2e,
	0x70, 0x72, 0x6f, 0x74, 0x6f, 0x22, 0x19, 0x0a, 0x17, 0x50, 0x6c, 0x75, 0x67, 0x69, 0x6e, 0x73,
	0x41, 0x76, 0x61, 0x69, 0x6c, 0x61, 0x62, 0x6c, 0x65, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74,
	0x22, 0x34, 0x0a, 0x18, 0x50, 0x6c, 0x75, 0x67, 0x69, 0x6e, 0x73, 0x41, 0x76, 0x61, 0x69, 0x6c,
	0x61, 0x62, 0x6c, 0x65, 0x52, 0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73, 0x65, 0x12, 0x18, 0x0a, 0x07,
	0x70, 0x6c, 0x75, 0x67, 0x69, 0x6e, 0x73, 0x18, 0x01, 0x20, 0x03, 0x28, 0x09, 0x52, 0x07, 0x70,
	0x6c, 0x75, 0x67, 0x69, 0x6e, 0x73, 0x32, 0xa5, 0x01, 0x0a, 0x0b, 0x43, 0x6f, 0x72, 0x65, 0x53,
	0x65, 0x72, 0x76, 0x69, 0x63, 0x65, 0x12, 0x95, 0x01, 0x0a, 0x10, 0x50, 0x6c, 0x75, 0x67, 0x69,
	0x6e, 0x73, 0x41, 0x76, 0x61, 0x69, 0x6c, 0x61, 0x62, 0x6c, 0x65, 0x12, 0x2d, 0x2e, 0x6b, 0x75,
	0x62, 0x65, 0x61, 0x70, 0x70, 0x73, 0x61, 0x70, 0x69, 0x73, 0x2e, 0x63, 0x6f, 0x72, 0x65, 0x2e,
	0x76, 0x31, 0x2e, 0x50, 0x6c, 0x75, 0x67, 0x69, 0x6e, 0x73, 0x41, 0x76, 0x61, 0x69, 0x6c, 0x61,
	0x62, 0x6c, 0x65, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x1a, 0x2e, 0x2e, 0x6b, 0x75, 0x62,
	0x65, 0x61, 0x70, 0x70, 0x73, 0x61, 0x70, 0x69, 0x73, 0x2e, 0x63, 0x6f, 0x72, 0x65, 0x2e, 0x76,
	0x31, 0x2e, 0x50, 0x6c, 0x75, 0x67, 0x69, 0x6e, 0x73, 0x41, 0x76, 0x61, 0x69, 0x6c, 0x61, 0x62,
	0x6c, 0x65, 0x52, 0x65, 0x73, 0x70, 0x6f, 0x6e, 0x73, 0x65, 0x22, 0x22, 0x82, 0xd3, 0xe4, 0x93,
	0x02, 0x1c, 0x12, 0x1a, 0x2f, 0x63, 0x6f, 0x72, 0x65, 0x2f, 0x76, 0x31, 0x2f, 0x70, 0x6c, 0x75,
	0x67, 0x69, 0x6e, 0x73, 0x2d, 0x61, 0x76, 0x61, 0x69, 0x6c, 0x61, 0x62, 0x6c, 0x65, 0x42, 0x4c,
	0x5a, 0x4a, 0x67, 0x69, 0x74, 0x68, 0x75, 0x62, 0x2e, 0x63, 0x6f, 0x6d, 0x2f, 0x6b, 0x75, 0x62,
	0x65, 0x61, 0x70, 0x70, 0x73, 0x2f, 0x6b, 0x75, 0x62, 0x65, 0x61, 0x70, 0x70, 0x73, 0x2f, 0x63,
	0x6d, 0x64, 0x2f, 0x6b, 0x75, 0x62, 0x65, 0x61, 0x70, 0x70, 0x73, 0x2d, 0x61, 0x70, 0x69, 0x2d,
	0x73, 0x65, 0x72, 0x76, 0x69, 0x63, 0x65, 0x2f, 0x6b, 0x75, 0x62, 0x65, 0x61, 0x70, 0x70, 0x73,
	0x61, 0x70, 0x69, 0x73, 0x2f, 0x63, 0x6f, 0x72, 0x65, 0x2f, 0x76, 0x31, 0x62, 0x06, 0x70, 0x72,
	0x6f, 0x74, 0x6f, 0x33,
}

var (
	file_kubeappsapis_core_v1_core_proto_rawDescOnce sync.Once
	file_kubeappsapis_core_v1_core_proto_rawDescData = file_kubeappsapis_core_v1_core_proto_rawDesc
)

func file_kubeappsapis_core_v1_core_proto_rawDescGZIP() []byte {
	file_kubeappsapis_core_v1_core_proto_rawDescOnce.Do(func() {
		file_kubeappsapis_core_v1_core_proto_rawDescData = protoimpl.X.CompressGZIP(file_kubeappsapis_core_v1_core_proto_rawDescData)
	})
	return file_kubeappsapis_core_v1_core_proto_rawDescData
}

var file_kubeappsapis_core_v1_core_proto_msgTypes = make([]protoimpl.MessageInfo, 2)
var file_kubeappsapis_core_v1_core_proto_goTypes = []interface{}{
	(*PluginsAvailableRequest)(nil),  // 0: kubeappsapis.core.v1.PluginsAvailableRequest
	(*PluginsAvailableResponse)(nil), // 1: kubeappsapis.core.v1.PluginsAvailableResponse
}
var file_kubeappsapis_core_v1_core_proto_depIdxs = []int32{
	0, // 0: kubeappsapis.core.v1.CoreService.PluginsAvailable:input_type -> kubeappsapis.core.v1.PluginsAvailableRequest
	1, // 1: kubeappsapis.core.v1.CoreService.PluginsAvailable:output_type -> kubeappsapis.core.v1.PluginsAvailableResponse
	1, // [1:2] is the sub-list for method output_type
	0, // [0:1] is the sub-list for method input_type
	0, // [0:0] is the sub-list for extension type_name
	0, // [0:0] is the sub-list for extension extendee
	0, // [0:0] is the sub-list for field type_name
}

func init() { file_kubeappsapis_core_v1_core_proto_init() }
func file_kubeappsapis_core_v1_core_proto_init() {
	if File_kubeappsapis_core_v1_core_proto != nil {
		return
	}
	if !protoimpl.UnsafeEnabled {
		file_kubeappsapis_core_v1_core_proto_msgTypes[0].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*PluginsAvailableRequest); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
		file_kubeappsapis_core_v1_core_proto_msgTypes[1].Exporter = func(v interface{}, i int) interface{} {
			switch v := v.(*PluginsAvailableResponse); i {
			case 0:
				return &v.state
			case 1:
				return &v.sizeCache
			case 2:
				return &v.unknownFields
			default:
				return nil
			}
		}
	}
	type x struct{}
	out := protoimpl.TypeBuilder{
		File: protoimpl.DescBuilder{
			GoPackagePath: reflect.TypeOf(x{}).PkgPath(),
			RawDescriptor: file_kubeappsapis_core_v1_core_proto_rawDesc,
			NumEnums:      0,
			NumMessages:   2,
			NumExtensions: 0,
			NumServices:   1,
		},
		GoTypes:           file_kubeappsapis_core_v1_core_proto_goTypes,
		DependencyIndexes: file_kubeappsapis_core_v1_core_proto_depIdxs,
		MessageInfos:      file_kubeappsapis_core_v1_core_proto_msgTypes,
	}.Build()
	File_kubeappsapis_core_v1_core_proto = out.File
	file_kubeappsapis_core_v1_core_proto_rawDesc = nil
	file_kubeappsapis_core_v1_core_proto_goTypes = nil
	file_kubeappsapis_core_v1_core_proto_depIdxs = nil
}
